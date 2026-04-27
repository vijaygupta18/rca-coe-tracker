import asyncio
import logging

from slack_sdk.web.async_client import AsyncWebClient
from slack_sdk.errors import SlackApiError

from app.config import settings

logger = logging.getLogger(__name__)

_MAX_RETRIES = 2


class SlackService:
    def __init__(self):
        if settings.slack_bot_token:
            self.client = AsyncWebClient(token=settings.slack_bot_token)
        else:
            self.client = None
            logger.warning("Slack bot token not configured; Slack integration is disabled.")

    def _check_client(self) -> bool:
        if self.client is None:
            logger.debug("Slack client not configured, skipping operation.")
            return False
        return True

    @staticmethod
    async def _retry_on_rate_limit(coro_factory, description: str = "Slack API call"):
        for attempt in range(_MAX_RETRIES + 1):
            try:
                return await coro_factory()
            except SlackApiError as e:
                if e.response.status_code == 429 and attempt < _MAX_RETRIES:
                    retry_after = int(e.response.headers.get("Retry-After", 1))
                    logger.warning(f"Rate limited on {description}, retrying after {retry_after}s (attempt {attempt + 1})")
                    await asyncio.sleep(retry_after)
                    continue
                raise

    async def post_dm(
        self,
        user_id: str,
        text: str,
        blocks: list[dict] | None = None,
        attachments: list[dict] | None = None,
    ) -> dict | None:
        if not self._check_client():
            return None
        try:
            conv = await self._retry_on_rate_limit(
                lambda: self.client.conversations_open(users=[user_id]),
                description="conversations_open",
            )
            channel_id = conv.data["channel"]["id"]
            kwargs: dict = {"channel": channel_id, "text": text}
            if blocks:
                kwargs["blocks"] = blocks
            if attachments:
                kwargs["attachments"] = attachments
            response = await self._retry_on_rate_limit(
                lambda: self.client.chat_postMessage(**kwargs),
                description="post_dm",
            )
            return response.data
        except SlackApiError as e:
            logger.error(f"Failed to DM user {user_id}: {e.response['error']}")
            return None

    async def lookup_by_email(self, email: str) -> dict | None:
        if not self._check_client():
            return None
        try:
            response = await self.client.users_lookupByEmail(email=email)
            user = response.data.get("user", {})
            return {
                "id": user.get("id"),
                "name": user.get("real_name") or user.get("name", "Unknown"),
                "email": user.get("profile", {}).get("email"),
            }
        except SlackApiError as e:
            if e.response.get("error") == "users_not_found":
                return None
            logger.error(f"Failed to lookup user by email {email}: {e.response['error']}")
            return None


slack_service = SlackService()
