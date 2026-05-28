import json
import os
import datetime
import urllib.parse
import boto3

ddb = boto3.resource("dynamodb")
table = ddb.Table("w5-agri-documents")

EXPECTED_API_KEY = os.environ.get("EXPECTED_API_KEY")

def lambda_handler(event, context):
    # S3 Event — skip API key check
    if "Records" in event and event["Records"][0].get("eventSource") == "aws:s3":
        record = event["Records"][0]
        bucket = record["s3"]["bucket"]["name"]
        key = urllib.parse.unquote_plus(record["s3"]["object"]["key"])
        event_time = record.get("eventTime", datetime.datetime.utcnow().isoformat() + "Z")

        item = {
            "documentId": key,
            "documentName": key.split("/")[-1],
            "source": "s3-event",
            "bucket": bucket,
            "key": key,
            "eventTime": event_time,
            "validationStatus": "processed",
            "uploadTime": datetime.datetime.utcnow().isoformat() + "Z",
            "efsPath": "s3://" + bucket + "/" + key
        }

        table.put_item(Item=item)

        return {
            "statusCode": 200,
            "body": json.dumps({"ok": True, "mode": "s3-event", "item": item})
        }

    # API Gateway Event — check x-api-key
    is_apigw = "requestContext" in event and "http" in event.get("requestContext", {})
    if is_apigw and EXPECTED_API_KEY:
        headers = event.get("headers") or {}
        api_key = (
            headers.get("x-api-key")
            or headers.get("X-Api-Key")
            or headers.get("X-API-Key")
        )
        if api_key != EXPECTED_API_KEY:
            return {
                "statusCode": 403,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"message": "Forbidden: missing or invalid API key"})
            }

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({
            "ok": True,
            "service": "document-validation",
            "message": "Validation request received",
            "time": datetime.datetime.utcnow().isoformat() + "Z"
        })
    }
