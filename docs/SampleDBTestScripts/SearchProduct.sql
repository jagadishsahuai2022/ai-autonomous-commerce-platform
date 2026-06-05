

:search_term = 'washing machine'

SELECT DISTINCT p.*
FROM public."Product" p
JOIN public."ProductCategoryMap" pcm 
    ON p."id" = pcm."productId"
JOIN public."ProductCategory" pc 
    ON pc."id" = pcm."categoryId"

JOIN public."ProductSubCategoryMap" pscm 
    ON p."id" = pscm."productId"
JOIN public."ProductSubCategory" psc 
    ON psc."id" = pscm."subCategoryId"

JOIN public."ProductTagMap" ptm 
    ON p."id" = ptm."productId"
JOIN public."ProductTag" pt 
    ON pt."id" = ptm."tagId"

JOIN public."ProductBusinessMetrics" pbm 
    ON p."id" = pbm."productId"

WHERE 
(
    p."genericName" ILIKE '%' || :search_term || '%' OR 
    p."description" ILIKE '%' || :search_term || '%' OR 

    pc."name" ILIKE '%' || :search_term || '%' OR 
    pc."description" ILIKE '%' || :search_term || '%' OR 
    pc."slug" ILIKE '%' || :search_term || '%' OR 

    psc."name" ILIKE '%' || :search_term || '%' OR 
    psc."description" ILIKE '%' || :search_term || '%' OR 
    psc."slug" ILIKE '%' || :search_term || '%' OR 

    pt."name" ILIKE '%' || :search_term || '%' OR 
    pt."description" ILIKE '%' || :search_term || '%' OR 
    pt."slug" ILIKE '%' || :search_term || '%'
)

-- Optional filters
-- AND pbm."inventoryCount" > 0
-- AND p."price" <= :max_price;