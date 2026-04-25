import asyncio
from database import async_session
from modules.suppliers.models import Supplier
from modules.promostandards.resolver import resolve_wsdl_url

async def run():
    async with async_session() as db:
        s = await db.get(Supplier, '6a67507b-a360-4d02-9200-b9aefb911f40')
        print("SanMar endpoint_cache type:", type(s.endpoint_cache))
        print("SanMar WSDL:", resolve_wsdl_url(s.endpoint_cache, 'product_data'))

if __name__ == '__main__':
    asyncio.run(run())
