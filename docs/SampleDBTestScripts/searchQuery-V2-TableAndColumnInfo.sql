SELECT DISTINCT 
    p.*,
    match_info.source_table,
    match_info.source_column
FROM public."Product" p
LEFT JOIN public."ProductCategoryMap" pcm 
    ON p."id" = pcm."productId"
LEFT JOIN public."ProductCategory" pc 
    ON pc."id" = pcm."categoryId"
LEFT JOIN public."ProductSubCategoryMap" pscm 
    ON p."id" = pscm."productId"
LEFT JOIN public."ProductSubCategory" psc 
    ON psc."id" = pscm."subCategoryId"
LEFT JOIN public."ProductTagMap" ptm 
    ON p."id" = ptm."productId"
LEFT JOIN public."ProductTag" pt 
    ON pt."id" = ptm."tagId"
CROSS JOIN LATERAL (
    VALUES
        ('Product', 'genericName', p."genericName"),
        ('Product', 'description', p."description"),
        ('ProductCategory', 'name', pc."name"),
        ('ProductCategory', 'description', pc."description"),
        ('ProductCategory', 'slug', pc."slug"),
        ('ProductSubCategory', 'name', psc."name"),
        ('ProductSubCategory', 'description', psc."description"),
        ('ProductSubCategory', 'slug', psc."slug"),
        ('ProductTag', 'name', pt."name"),
        ('ProductTag', 'description', pt."description"),
        ('ProductTag', 'slug', pt."slug")
) AS match_info(source_table, source_column, value)
WHERE match_info.value ILIKE '%' || :search_term || '%';