# RCA COE Tracker — Deploy Runbook

Single-pod FastAPI + React app fronted by an upstream identity proxy
(Pomerium / oauth2-proxy / similar). In-cluster Postgres on a PVC.

Replace `your-namespace`, `your-registry`, and `rca-coe.example.com` with
your real values throughout this runbook and in `prodk8s/deployment.yaml`
before applying.

---

## 1. First-time setup

```bash
# Edit prodk8s/deployment.yaml and fill in:
#   - namespace                                  (replace `your-namespace`)
#   - rca-coe-db-secret.POSTGRES_PASSWORD        (set a real password)
#   - rca-coe-secrets.DATABASE_URL               (must match the password above)
#   - rca-coe-secrets.SLACK_BOT_TOKEN            (your Slack bot token; optional)
#   - rca-coe-secrets.SLACK_SIGNING_SECRET       (optional)
#   - rca-coe-secrets.AI_API_KEY                 (optional, for AI summaries)
#   - rca-coe-config.APP_BASE_URL / CORS_ORIGINS (your public URL)
#   - rca-coe-config.ADMIN_EMAILS                (seed admin emails)
#   - Deployment image                           (your registry + tag)

kubectl apply -f prodk8s/deployment.yaml

# Wait for the PVC to bind and Postgres to come up.
kubectl get pvc -n your-namespace rca-coe-pgdata -w
kubectl rollout status statefulset/rca-coe-db -n your-namespace
```

## 2. Initialize the database (first deploy + every release)

`init.sql` (run once) sets schema + grants. The migrations under
`backend/migrations/*.sql` are **idempotent** — they all use `IF NOT EXISTS`
/ `ADD COLUMN IF NOT EXISTS`, so running every migration on every release
is safe.

```bash
# First deploy only: schema + grants.
kubectl exec -i -n your-namespace rca-coe-db-0 -- \
  psql -U rca -d rca_coe < prodk8s/init.sql

# Apply every migration in order (run before each release that ships new SQL).
for f in $(ls backend/migrations/*.sql | sort); do
  echo "Applying $f"
  kubectl exec -i -n your-namespace rca-coe-db-0 -- \
    psql -U rca -d rca_coe -v ON_ERROR_STOP=1 -f /dev/stdin < "$f" \
    || { echo "Migration $f failed; aborting."; exit 1; }
done

# Sanity check.
kubectl exec -it -n your-namespace rca-coe-db-0 -- \
  psql -U rca -d rca_coe -c "\dt rca_coe.*"
```

Shipped migrations:

- `001_init.sql` — base schema (users, rcas, rca_assignees, rca_history)
- `002_incident_fields.sql` — severity, environment, services_affected, 4 incident timestamps
- `003_user_admin.sql` — `users.is_admin` column for in-app admin promotion

## 3. Build & push the image

The `Dockerfile` is multi-stage: stage 1 builds the SPA with Vite, stage 2
copies it into the FastAPI image so a single container serves both `/api/*`
and the SPA.

```bash
docker build --platform linux/amd64 \
  --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) \
  --build-arg APP_VERSION=0.1.0 \
  -t your-registry/rca-coe-tracker:0.1.0 .

docker push your-registry/rca-coe-tracker:0.1.0
```

`/api/version` reflects the `APP_VERSION` and `GIT_COMMIT` build args, so
you can verify which build is live in production.

## 4. Roll out

```bash
kubectl set image deployment/rca-coe-tracker \
  rca-coe-tracker=your-registry/rca-coe-tracker:0.1.0 \
  -n your-namespace

kubectl rollout status deployment/rca-coe-tracker -n your-namespace
```

## 5. Identity proxy route

The app trusts forwarded identity headers from your upstream proxy. The
required headers are:

- `x-pomerium-claim-email` (also accepts `x-pomerium-user-email` or `x-forwarded-email`)
- `x-pomerium-claim-name`  (also accepts `x-pomerium-user-name`  or `x-forwarded-user`)

If you use **Pomerium**, add a route like:

```yaml
- from: https://rca-coe.example.com
  to: http://rca-coe-tracker.your-namespace.svc.cluster.local:8000
  allowed_domains: [example.com]
  pass_identity_headers: true
```

`pass_identity_headers: true` is what gives the backend the claim headers
it relies on.

If you use **oauth2-proxy**, set `--set-xauthrequest=true` and forward
`X-Auth-Request-Email` / `X-Auth-Request-User`, then add a small reverse
proxy rule that aliases those to `x-pomerium-claim-email` / `-name` before
the request hits the app — or fork `app/auth.py:_read_pomerium_identity`
to read your headers directly.

## 6. Smoke test

```bash
# From inside the cluster (no proxy) — should be 401 (no identity header).
kubectl run -it --rm curl --image=curlimages/curl --restart=Never -n your-namespace -- \
  curl -s -o /dev/null -w '%{http_code}\n' \
  http://rca-coe-tracker.your-namespace.svc.cluster.local:8000/api/me

# Health check should always be 200 (no auth).
kubectl run -it --rm curl --image=curlimages/curl --restart=Never -n your-namespace -- \
  curl -s http://rca-coe-tracker.your-namespace.svc.cluster.local:8000/api/health

# From your browser via the proxy — should land on the SPA.
open https://rca-coe.example.com/
```

## Logs / debugging

```bash
kubectl logs -n your-namespace -l app=rca-coe-tracker --tail=100 -f
kubectl logs -n your-namespace rca-coe-db-0 --tail=100 -f
```

## Admin bootstrap

`ADMIN_EMAILS` in `rca-coe-config` seeds DB-level admin status when those
users log in for the first time. After they've logged in once, admin status
lives on the DB (`users.is_admin`) and can be changed via the in-app Users
page (admin-only).

The seed list is also a recovery path: emails listed there cannot be
demoted or deleted from the UI, so the system can never lock itself out.

To add a new admin:

1. Log in as an existing admin and promote them via the Users page; or
2. Add their email to `ADMIN_EMAILS` in the ConfigMap and have them log in.

## Rotating the DB password

1. `kubectl edit secret rca-coe-db-secret -n your-namespace` → update `POSTGRES_PASSWORD`.
2. `kubectl exec -it -n your-namespace rca-coe-db-0 -- psql -U rca -d rca_coe -c "ALTER USER rca WITH PASSWORD '<new>';"`.
3. `kubectl edit secret rca-coe-secrets -n your-namespace` → update `DATABASE_URL` to match.
4. `kubectl rollout restart deployment/rca-coe-tracker -n your-namespace`.
