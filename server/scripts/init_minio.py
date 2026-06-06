#!/usr/bin/env python3
"""scripts/init_minio.py - MinIO Bucket 初始化"""

import os
import sys
import json
from minio import Minio

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "127.0.0.1:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "Cs516@2026")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "Cs516@2026")
BUCKET_NAME = os.getenv("MINIO_BUCKET", "baby-album")


def main():
    print(f"Connecting MinIO: {MINIO_ENDPOINT}")
    client = Minio(MINIO_ENDPOINT, access_key=MINIO_ACCESS_KEY,
                   secret_key=MINIO_SECRET_KEY, secure=False)

    if not client.bucket_exists(BUCKET_NAME):
        client.make_bucket(BUCKET_NAME)
        print(f"Bucket '{BUCKET_NAME}' created")
    else:
        print(f"Bucket '{BUCKET_NAME}' already exists")

    policy = json.dumps({
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"AWS": "*"},
            "Action": ["s3:GetObject"],
            "Resource": [
                f"arn:aws:s3:::{BUCKET_NAME}/thumbnails/*",
                f"arn:aws:s3:::{BUCKET_NAME}/avatars/*",
            ],
        }],
    })
    client.set_bucket_policy(BUCKET_NAME, policy)
    print("Public read policy set (thumbnails/ + avatars/)")

    for b in client.list_buckets():
        print(f"  - {b.name} ({b.creation_date})")
    print("Done!")


if __name__ == "__main__":
    main()