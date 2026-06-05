-- Update demo users with bcrypt-hashed passwords
UPDATE "User" SET "passwordHash" = '$2b$10$aONBLAlmh0.WLHp7ZlhvBetcBBHyRmJITEfZJblcRTipL29wzTQke' WHERE email = 'admin@delegatecart.com';
UPDATE "User" SET "passwordHash" = '$2b$10$jtC.Z1Wj2ckANh3koac/aOm6dTLgEGs947SiuwyRKiJlj1/UvYl7K' WHERE email = 'demo@example.com';
UPDATE "User" SET "passwordHash" = '$2b$10$W4eZmBDBcQIjIWTtR.k/0OVgSggCbB.L0CdkrlGjGqTMlzVR8itha' WHERE email = 'supervisedlearning@delegatecart.com';
UPDATE "User" SET "passwordHash" = '$2b$10$F5GF4QYCpA.Qiqs2AhG.WeMlNAY/HMCxm9Ig7Y9EUk7c8RV/hFR1K' WHERE email = 'observability@delegatecart.com';

-- Verify password hashes were added
SELECT email, "passwordHash" FROM "User" WHERE email IN ('admin@delegatecart.com', 'demo@example.com', 'supervisedlearning@delegatecart.com', 'observability@delegatecart.com');
