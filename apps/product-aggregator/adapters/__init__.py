"""Adapters package."""

from adapters.base_adapter import ProductAdapter
from adapters.internal_db_adapter import InternalDBAdapter
from adapters.amazon_adapter import AmazonAdapter
from adapters.flipkart_adapter import FlipkartAdapter

__all__ = [
    "ProductAdapter",
    "InternalDBAdapter",
    "AmazonAdapter",
    "FlipkartAdapter",
]
