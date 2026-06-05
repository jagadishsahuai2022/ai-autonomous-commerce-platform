"""LLM Service for intent processing using OpenAI or Anthropic."""

import json
import logging
from typing import Optional, Dict, Any
from abc import ABC, abstractmethod
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    async def call(self, system_prompt: str, user_prompt: str, temperature: float = 0.3, max_tokens: int = 500) -> str:
        """Call the LLM and return response text."""
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        """Get the model name."""
        pass


class OpenAIProvider(LLMProvider):
    """OpenAI LLM provider."""

    def __init__(self, api_key: str, model: str = "gpt-4-turbo-preview"):
        """Initialize OpenAI provider."""
        try:
            import openai
            self.client = openai.OpenAI(api_key=api_key)
            self.model = model
        except ImportError:
            raise ImportError("openai package not installed. Install with: pip install openai")

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def call(self, system_prompt: str, user_prompt: str, temperature: float = 0.3, max_tokens: int = 500) -> str:
        """Call OpenAI API."""
        logger.debug(f"Calling OpenAI with model {self.model}")
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"}
        )
        
        return response.choices[0].message.content

    def get_model_name(self) -> str:
        """Get model name."""
        return self.model


class AnthropicProvider(LLMProvider):
    """Anthropic Claude LLM provider."""

    def __init__(self, api_key: str, model: str = "claude-3-opus-20240229"):
        """Initialize Anthropic provider."""
        try:
            import anthropic
            self.client = anthropic.Anthropic(api_key=api_key)
            self.model = model
        except ImportError:
            raise ImportError("anthropic package not installed. Install with: pip install anthropic")

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def call(self, system_prompt: str, user_prompt: str, temperature: float = 0.3, max_tokens: int = 500) -> str:
        """Call Anthropic API."""
        logger.debug(f"Calling Anthropic with model {self.model}")
        
        message = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=[
                {"role": "user", "content": user_prompt}
            ]
        )
        
        return message.content[0].text

    def get_model_name(self) -> str:
        """Get model name."""
        return self.model


class LLMService:
    """Unified LLM service for intent parsing."""

    def __init__(self, provider: str = "openai", **kwargs):
        """Initialize LLM service with provider."""
        self.provider = self._initialize_provider(provider, **kwargs)

    def _initialize_provider(self, provider: str, **kwargs) -> LLMProvider:
        """Initialize the appropriate LLM provider."""
        if provider.lower() == "openai":
            api_key = kwargs.get("openai_api_key")
            model = kwargs.get("openai_model", "gpt-4-turbo-preview")
            if not api_key:
                raise ValueError("OPENAI_API_KEY not provided")
            return OpenAIProvider(api_key, model)
            
        elif provider.lower() == "anthropic":
            api_key = kwargs.get("anthropic_api_key")
            model = kwargs.get("anthropic_model", "claude-3-opus-20240229")
            if not api_key:
                raise ValueError("ANTHROPIC_API_KEY not provided")
            return AnthropicProvider(api_key, model)
            
        else:
            raise ValueError(f"Unknown LLM provider: {provider}")

    async def parse_intent(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 500
    ) -> Dict[str, Any]:
        """Parse intent using LLM."""
        logger.info("Starting intent parsing with LLM")
        response_text = ""
        try:
            response_text = await self.provider.call(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=temperature,
                max_tokens=max_tokens
            )
            
            # Parse JSON response
            logger.debug(f"Raw LLM response: {response_text[:200]}...")
            parsed_response = json.loads(response_text)
            
            logger.info("Intent parsing completed successfully")
            return parsed_response
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            raise ValueError(f"LLM response was not valid JSON: {response_text[:200]}")
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            raise

    def get_model_info(self) -> Dict[str, str]:
        """Get information about the current model."""
        return {
            "provider": self.provider.__class__.__name__,
            "model": self.provider.get_model_name()
        }
