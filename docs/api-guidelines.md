# API Guidelines

Base URL

/api/v1

Authentication

Bearer JWT

Response

{
"success": true,
"data": {}
}

Errors

{
"success": false,
"message": "...",
"errors": []
}

Pagination

?page=1&limit=20

HTTP Status Codes

200

201

400

401

403

404

409

422

500
