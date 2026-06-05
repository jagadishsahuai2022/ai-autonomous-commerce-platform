SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'User' AND table_schema = 'public' ORDER BY ordinal_position;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'UserAddress' AND table_schema = 'public' ORDER BY ordinal_position;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'UserSession' AND table_schema = 'public' ORDER BY ordinal_position;
