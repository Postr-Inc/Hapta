# Health Status

A service that helps determine how healthy the server is - whenever a failed request goes through it will ping the counter of unhealthy requests, if a request takes too long to be resolved that will ping the counter for delayed requests and so forth