调用模型，生成任务

```
curl --location 'https://api.kie.ai/api/v1/jobs/createTask' \ --header 'Authorization: Bearer <token>' \ --header 'Content-Type: application/json' \ --data '{    "model": "gpt-image-2-image-to-image",    "callBackUrl": "https://your-domain.com/api/callback",    "input": {        "prompt": "take a photo with Sam Altman in the conference room",        "input_urls": [            "https://static.aiquickdraw.com/tools/example/1776782793756_wrogXTdd.png"        ],        "aspect_ratio": "auto"    } }'
```

```
{    "code": 200,    "msg": "success",    "data": {        "taskId": "task_gptimage_1765180586443"    } }
```





查询任务详情

```
curl --location 'https://api.kie.ai/api/v1/jobs/recordInfo?taskId=undefined' \
--header 'Authorization: Bearer <token>'
```

```
{
    "code": 505,
    "msg": "success",
    "data": {
        "taskId": "task_12345678",
        "model": "grok-imagine/text-to-image",
        "state": "success",
        "param": "{\"model\":\"grok-imagine/text-to-image\",\"callBackUrl\":\"https://your-domain.com/api/callback\",\"input\":{\"prompt\":\"Cinematic portrait...\",\"aspect_ratio\":\"3:2\"}}",
        "resultJson": "{\"resultUrls\":[\"https://example.com/generated-content.jpg\"]}",
        "failCode": "",
        "failMsg": "",
        "costTime": 15000,
        "completeTime": 1698765432000,
        "createTime": 1698765400000,
        "updateTime": 1698765432000,
        "progress": 45,
        "creditsConsumed": 50
    }
}
```

