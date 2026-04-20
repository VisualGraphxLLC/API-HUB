"""S&S Activewear JSON normalizer."""

from collections import defaultdict
from modules.promostandards.schemas import (
    PSProductData,
    PSProductPart,
    PSInventoryLevel,
    PSPricePoint,
    PSMediaItem,
)

def ss_to_ps_format(
    ss_products: list[dict],
) -> tuple[
    list[PSProductData],
    list[PSInventoryLevel],
    list[PSPricePoint],
    list[PSMediaItem],
]:
    """Group S&S part rows by styleID -> emit PS-format typed models."""
    
    products_by_style: dict[str, dict] = {}
    parts_by_style: dict[str, list[PSProductPart]] = defaultdict(list)
    media_by_style: dict[str, dict[str, PSMediaItem]] = defaultdict(dict)
    
    inventories: list[PSInventoryLevel] = []
    prices: list[PSPricePoint] = []
    
    for row in ss_products:
        style_id = str(row.get("styleID"))
        sku = str(row.get("sku"))
        
        # 1. Product extraction mapping
        if style_id not in products_by_style:
            products_by_style[style_id] = {
                "product_id": style_id,
                "product_name": row.get("styleName"),
                "brand": row.get("brandName"),
                "description": "", # Details missing from basic view
                "categories": [row.get("categoryName")] if row.get("categoryName") else [],
                "product_type": "apparel",
            }
            
        # 2. Product Part mapping
        part = PSProductPart(
            part_id=sku,
            color_name=row.get("colorName"),
            size_name=row.get("sizeName"),
            description=None
        )
        parts_by_style[style_id].append(part)
        
        # 3. Inventory Mapping
        inventories.append(
            PSInventoryLevel(
                product_id=style_id,
                part_id=sku,
                quantity_available=min(row.get("qty", 0), 500), # PS cap convention
                warehouse_code=row.get("warehouseAbbr")
            )
        )
        
        # 4. Pricing Mapping
        if "yourPrice" in row and row["yourPrice"] is not None:
            prices.append(
                PSPricePoint(
                    product_id=style_id,
                    part_id=sku,
                    price=float(row["yourPrice"]),
                    quantity_min=1,
                    price_type="piece"
                )
            )
            
        # 5. Media Item mapping (deduped by color/url)
        img_url = row.get("colorFrontImage")
        color = row.get("colorName")
        if img_url:
            media_key = f"{color}_{img_url}"
            if media_key not in media_by_style[style_id]:
                media_by_style[style_id][media_key] = PSMediaItem(
                    product_id=style_id,
                    url=img_url,
                    media_type="front",
                    color_name=color
                )

    # Compile the final lists
    products: list[PSProductData] = []
    all_media: list[PSMediaItem] = []
    
    for style_id, prod_dict in products_by_style.items():
        prod_dict["parts"] = parts_by_style[style_id]
        products.append(PSProductData(**prod_dict))
        all_media.extend(media_by_style[style_id].values())
        
    return products, inventories, prices, all_media

if __name__ == "__main__":
    # Small inline test
    sample_data = [
        {
            "sku": "B00760001",
            "yourPrice": 3.79,
            "styleID": "39",
            "styleName": "PC61",
            "brandName": "Port & Company",
            "colorName": "Navy",
            "sizeName": "M",
            "qty": 1420,
            "warehouseAbbr": "IL",
            "colorFrontImage": "https://cdn.example.com/navy.jpg"
        },
        {
            "sku": "B00760002",
            "yourPrice": 3.79,
            "styleID": "39",
            "styleName": "PC61",
            "brandName": "Port & Company",
            "colorName": "Navy",
            "sizeName": "L",
            "qty": 50,
            "warehouseAbbr": "IL",
            "colorFrontImage": "https://cdn.example.com/navy.jpg"
        }
    ]
    
    prods, invs, prcs, meds = ss_to_ps_format(sample_data)
    assert len(prods) == 1, "Should group into 1 product"
    assert len(prods[0].parts) == 2, "Should have 2 parts"
    assert len(invs) == 2, "Should have 2 inventory records"
    assert len(prcs) == 2, "Should have 2 price points"
    assert len(meds) == 1, "Should deduplicate to 1 identical media item"
    print("All S&S normalizer tests passed!")
