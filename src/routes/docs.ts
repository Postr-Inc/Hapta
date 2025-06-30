// src/routes/docs.ts
//@ts-nocheck
import { Hono } from "hono";
import { swaggerUI } from '@hono/swagger-ui';
import { apiReference } from '@scalar/hono-api-reference';

const docs = new Hono();

export default (config: any) => {

  /**
   * Serves the Swagger UI for API documentation.
   * @route GET /
   */
  docs.get('/', swaggerUI({ url: '/openapi.json' }));

  /**
   * Serves the OpenAPI 3.0.0 specification JSON.
   * @route GET /openapi.json
   */
  docs.get('/openapi.json', (c) => {
    return c.json({
      openapi: '3.0.0',
      info: {
        title: 'Postly API',
        version: globalThis.version || '1.0.0',
        description: 'API documentation for Postly backend services.',
      },
      servers: [
        {
          url: `http://localhost:${config.Server.Port || 3000}`,
          description: 'Local development server',
        },
        {
          url: `https://api.postlyapp.com`,
          description: "Production Server Requires Dev Access Key"
        }
      ],
      tags: [
        { name: 'Authentication', description: 'User authentication and account management.' },
        { name: 'Files', description: 'File upload and serving.' },
        { name: 'Collections', description: 'CRUD operations on database collections.' },
        { name: 'Actions', description: 'User-initiated actions like follow, like, bookmark.' },
        { name: 'Utility', description: 'Miscellaneous utility endpoints.' },
      ],
      paths: {
        '/auth/register': {
          post: {
            tags: ['Authentication'],
            summary: 'Register a new user account',
            description: 'Registers a new user with email, password, username, and date of birth.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      email: { type: 'string', format: 'email', description: 'User\'s email address.' },
                      password: { type: 'string', minLength: 8, description: 'User\'s password (minimum 8 characters).' },
                      username: { type: 'string', description: 'Unique username for the user.' },
                      dob: { type: 'string', format: 'date', description: 'User\'s date of birth (YYYY-MM-DD).' },
                    },
                    required: ['email', 'password', 'username', 'dob'],
                  },
                  examples: {
                    newUser: {
                      value: {
                        email: 'user@example.com',
                        password: 'StrongPassword123',
                        username: 'newuser',
                        dob: '2000-01-01',
                      },
                    },
                  },
                },
              },
            },
            responses: {
              200: { description: 'Registration successful.' },
              400: { description: 'Bad request, e.g., missing fields.' },
              409: { description: 'Conflict, e.g., email or username already exists.' },
              500: { description: 'Internal server error.' },
            },
          },
        },
        '/auth/login': {
          post: {
            tags: ['Authentication'],
            summary: 'Login user and obtain access token',
            description: 'Authenticates a user and returns a JWT access token for subsequent requests.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      emailOrUsername: { type: 'string', description: 'User\'s email or username.' },
                      password: { type: 'string', description: 'User\'s password.' },
                      deviceInfo: { type: 'object', nullable: true, description: 'Optional device information for session tracking.' },
                    },
                    required: ['emailOrUsername', 'password'],
                  },
                  examples: {
                    userLogin: {
                      value: {
                        emailOrUsername: 'user@example.com',
                        password: 'StrongPassword123',
                        deviceInfo: { os: 'iOS', model: 'iPhone 15' },
                      },
                    },
                  },
                },
              },
            },
            responses: {
              200: {
                description: 'Login successful, returns JWT token.',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        token: { type: 'string', description: 'JWT access token.' },
                      },
                    },
                  },
                },
              },
              401: { description: 'Invalid credentials.' },
              400: { description: 'Missing email/username or password.' },
            },
          },
        },
        '/auth/verify': {
          post: { // Changed to POST to align with common verification patterns or keep GET based on preference
            tags: ['Authentication'],
            summary: 'Verify current access token',
            description: 'Checks if the provided JWT token is valid and active.',
            security: [{ bearerAuth: [] }],
            responses: {
              200: { description: 'Token is valid.' },
              401: { description: 'Invalid or missing token.' },
              500: { description: 'Internal server error.' },
            },
          },
        },
        '/auth/refreshtoken': {
          post: {
            tags: ['Authentication'],
            summary: 'Refresh an expired or soon-to-expire access token',
            description: 'Exchanges an existing valid token for a new one to extend the session.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      token: { type: 'string', description: 'The token to refresh.' },
                    },
                    required: ['token'],
                  },
                },
              },
            },
            responses: {
              200: {
                description: 'Token refreshed successfully.',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        token: { type: 'string', description: 'New JWT access token.' },
                      },
                    },
                  },
                },
              },
              401: { description: 'Invalid or missing token, or token already expired.' },
              500: { description: 'Failed to refresh token due to internal error.' },
            },
          },
        },
        '/auth/requestPasswordReset': {
          post: {
            tags: ['Authentication'],
            summary: 'Request a password reset link',
            description: 'Sends a password reset email to the provided email address.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      email: { type: 'string', format: 'email', description: 'Email address of the user requesting reset.' },
                    },
                    required: ['email'],
                  },
                },
              },
            },
            responses: {
              200: { description: 'Password reset email sent (if email exists).' },
              400: { description: 'Missing email.' },
              500: { description: 'Error requesting password reset.' },
            },
          },
        },
        '/auth/resetPassword': {
          post: {
            tags: ['Authentication'],
            summary: 'Reset password using a reset token',
            description: 'Resets the user\'s password using a token received via email.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      resetToken: { type: 'string', description: 'The password reset token.' },
                      password: { type: 'string', minLength: 8, description: 'The new password.' },
                    },
                    required: ['resetToken', 'password'],
                  },
                },
              },
            },
            responses: {
              200: { description: 'Password reset successfully.' },
              400: { description: 'Missing reset token or password.' },
              401: { description: 'Invalid or expired reset token.' },
              500: { description: 'Error resetting password.' },
            },
          },
        },
        '/auth/get-basic-auth-token': {
          post: {
            tags: ['Authentication'],
            summary: 'Generate a basic authentication token',
            description: 'Generates a basic token with read, write, delete permissions. Intended for internal/system use.',
            responses: {
              200: {
                description: 'Successfully created basic auth token.',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { type: 'number' },
                        message: { type: 'string' },
                        token: { type: 'string', description: 'The generated basic authentication token.' },
                        id: { type: 'string', description: 'A unique ID associated with the token.' },
                      },
                    },
                  },
                },
              },
              500: { description: 'Internal server error generating token.' },
            },
          },
        },
        '/auth/delete': {
          delete: {
            tags: ['Authentication'],
            summary: 'Delete user account',
            description: 'Deletes the authenticated user\'s account.',
            security: [{ bearerAuth: [] }],
            responses: {
              200: { description: 'User account deleted successfully.' },
              401: { description: 'Invalid or missing token.' },
              500: { description: 'Issue deleting account.' },
            },
          },
        },
        '/auth/check': {
          post: {
            tags: ['Authentication'],
            summary: 'Check if email or username exists',
            description: 'Checks if a given email or username is already registered.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      email: { type: 'string', format: 'email', nullable: true, description: 'Email to check.' },
                      username: { type: 'string', nullable: true, description: 'Username to check.' },
                    },
                    minProperties: 1,
                  },
                  examples: {
                    checkEmail: {
                      value: { email: 'existing@example.com' },
                    },
                    checkUsername: {
                      value: { username: 'existinguser' },
                    },
                  },
                },
              },
            },
            responses: {
              200: { description: 'Check successful, returns availability status.' },
              400: { description: 'Missing email or username.' },
              500: { description: 'Internal server error during check.' },
            },
          },
        },

        '/api/files/{collection}/{id}/{file}': {
          get: {
            tags: ['Files'],
            summary: 'Retrieve a file from storage',
            description: 'Serves files stored in Pocketbase, supporting range requests for video streaming.',
            parameters: [
              { name: 'collection', in: 'path', required: true, schema: { type: 'string' }, description: 'Name of the Pocketbase collection.' },
              { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID of the record containing the file.' },
              { name: 'file', in: 'path', required: true, schema: { type: 'string' }, description: 'Name of the file to retrieve.' },
            ],
            responses: {
              200: { description: 'Full file content.', content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } },
              206: { description: 'Partial content (for video streaming with Range header).', content: { 'video/mp4': { schema: { type: 'string', format: 'binary' } } } },
              404: { description: 'File not found.' },
              416: { description: 'Range Not Satisfiable (invalid range header).' },
              500: { description: 'Server error fetching file.' },
            },
          },
          head: {
            tags: ['Files'],
            summary: 'Get file metadata (HEAD request)',
            description: 'Retrieves metadata about a file, useful for checking existence and size without downloading the full content (e.g., for iOS compatibility).',
            parameters: [
              { name: 'collection', in: 'path', required: true, schema: { type: 'string' }, description: 'Name of the Pocketbase collection.' },
              { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID of the record containing the file.' },
              { name: 'file', in: 'path', required: true, schema: { type: 'string' }, description: 'Name of the file to retrieve.' },
            ],
            responses: {
              200: { description: 'File metadata (headers only).' },
              404: { description: 'File not found.' },
              500: { description: 'Server error fetching metadata.' },
            },
          },
          options: {
            tags: ['Files'],
            summary: 'CORS preflight for file access',
            description: 'Handles CORS preflight requests for the file endpoint.',
            responses: {
              204: { description: 'No content, successful preflight.' },
            },
          },
        },

        '/collection/{collection}': {
          post: {
            tags: ['Collections'],
            summary: 'Perform CRUD operations on a collection',
            description: 'Handles various operations (create, retrieve, update, delete) on a specified Pocketbase collection. Supports JSON and multipart/form-data for file uploads.',
            security: [{ bearerAuth: [] }],
            parameters: [
              { name: 'collection', in: 'path', required: true, schema: { type: 'string' }, description: 'The name of the collection to operate on.' },
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', description: 'Type of operation (e.g., "create", "get", "update", "delete", "list").' },
                      payload: {
                        type: 'object',
                        description: 'Operation-specific data (e.g., fields for create/update, query for get/list, id for delete).',
                      },
                      security: {
                        type: 'object',
                        properties: {
                          token: { type: 'string', description: 'Optional: JWT token if not in Authorization header.' },
                        },
                        nullable: true,
                      },
                      callback: { type: 'string', nullable: true, description: 'Optional: A callback identifier for asynchronous operations.' },
                    },
                    required: ['type', 'payload'],
                  },
                  examples: {
                    createPost: {
                      value: {
                        type: 'create',
                        payload: {
                          fields: {
                            title: 'My New Post',
                            content: 'This is some content.',
                            author: 'user_id_here'
                          }
                        }
                      }
                    },
                    listPosts: {
                      value: {
                        type: 'list',
                        payload: {
                          options: {
                            page: 1,
                            perPage: 10,
                            sort: '-created'
                          }
                        }
                      }
                    }
                  }
                },
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', description: 'Type of operation (e.g., "create", "update").' },
                      callback: { type: 'string', nullable: true, description: 'Optional: A callback identifier.' },
                    },
                    required: ['type'],
                  },
                  encoding: {
                    'files[]': {
                      contentType: 'application/octet-stream',
                    },
                  },
                },
              },
            },
            responses: {
              200: { description: 'Operation successful, returns result data.' },
              401: { description: 'Invalid or missing token.' },
              400: { description: 'Bad request (e.g., invalid payload, missing parameters).' },
              500: { description: 'Internal server error.' },
            },
          },
        },

        '/actions/{type}/{action_type}': {
          post: {
            tags: ['Actions'],
            summary: 'Perform specific user actions (follow, like, bookmark)',
            description: 'Allows authenticated users to perform actions on other users, posts, or comments.',
            security: [{ bearerAuth: [] }],
            parameters: [
              { name: 'type', in: 'path', required: true, schema: { type: 'string', enum: ['users', 'posts', 'comments'] }, description: 'The type of entity to act upon.' },
              { name: 'action_type', in: 'path', required: true, schema: { type: 'string', enum: ['follow', 'unfollow', 'block', 'unblock', 'like', 'unlike', 'bookmark'] }, description: 'The specific action to perform.' },
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      targetId: { type: 'string', description: 'The ID of the target user, post, or comment.' },
                    },
                    required: ['targetId'],
                  },
                  examples: {
                    followUser: {
                      value: { targetId: 'target_user_id' },
                    },
                    likePost: {
                      value: { targetId: 'target_post_id' },
                    },
                  },
                },
              },
            },
            responses: {
              200: { description: 'Action completed successfully.' },
              401: { description: 'Invalid or missing token.' },
              400: { description: 'Invalid request or basic token used for this action.' },
              404: { description: 'Target entity not found.' },
              500: { description: 'Internal server error.' },
            },
          },
        },

        '/deepsearch': {
          post: {
            tags: ['Utility'],
            summary: 'Perform a deep search',
            description: 'Executes a complex search operation across various data types. Requires authentication.',
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', description: 'Type of deep search (e.g., "users", "posts").' },
                      payload: { type: 'object', description: 'Search query and options.' },
                      callback: { type: 'string', nullable: true, description: 'Optional callback identifier.' },
                    },
                    required: ['type', 'payload'],
                  },
                },
              },
            },
            responses: {
              200: { description: 'Search successful, returns results.' },
              401: { description: 'Invalid or missing token.' },
              500: { description: 'Internal server error during search.' },
            },
          },
        },
        '/opengraph/embed': {
          get: {
            tags: ['Utility'],
            summary: 'Fetch OpenGraph metadata for a URL',
            description: 'Retrieves OpenGraph (OG) metadata (title, description, image, etc.) from a given URL for embedding purposes.',
            parameters: [
              { name: 'url', in: 'query', required: true, schema: { type: 'string', format: 'url' }, description: 'The URL to fetch OG metadata from.' },
            ],
            responses: {
              200: {
                description: 'Successfully fetched OpenGraph metadata.',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        description: { type: 'string' },
                        image: { type: 'string', format: 'url' },
                        url: { type: 'string', format: 'url' },
                      },
                    },
                  },
                },
              },
              400: { description: 'Missing URL parameter.' },
              500: { description: 'Failed to fetch metadata from the provided URL.' },
            },
          },
        },
        '/embed/{collection}/{id}/{type}': {
          get: {
            tags: ['Utility'],
            summary: 'Serve dynamic embed content',
            description: 'Generates and serves HTML content for embedding external resources, often used for rich previews.',
            parameters: [
              { name: 'collection', in: 'path', required: true, schema: { type: 'string' }, description: 'The collection of the item to embed.' },
              { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'The ID of the item to embed.' },
              { name: 'type', in: 'path', required: true, schema: { type: 'string' }, description: 'The type of embed (e.g., "post", "user").' },
            ],
            responses: {
              200: { description: 'Successfully rendered HTML embed content.', content: { 'text/html': { schema: { type: 'string' } } } },
              500: { description: 'Error rendering embed content.' },
            },
          },
        },
        '/health': {
          get: {
            tags: ['Utility'],
            summary: 'Server health check',
            description: 'Checks if the server is running and responsive.',
            responses: {
              200: {
                description: 'Server is running.',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { type: 'number', example: 200 },
                        message: { type: 'string', example: 'Server is running' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/subscriptions': {
          get: {
            tags: ['Utility'],
            summary: 'Establish WebSocket connection for real-time subscriptions',
            description: 'Establishes a WebSocket connection for real-time updates and actions like rolling new tokens.',
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: 'Authorization',
                in: 'header',
                required: false,
                schema: { type: 'string' },
                description: 'Bearer JWT token for authentication.',
              },
            ],
            responses: {
              101: { description: 'Switching Protocols (WebSocket upgrade successful).' },
              401: { description: 'Unauthorized due to invalid or missing token in initial handshake or subsequent messages.' },
            },
          },
        },
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT authorization header using the Bearer scheme. Example: "Authorization: Bearer {token}"',
          },
        },
        schemas: {
          ErrorResponse: {
            type: 'object',
            properties: {
              status: { type: 'number', description: 'HTTP status code or custom error code.' },
              message: { type: 'string', description: 'Descriptive error message.' },
              expanded: { type: 'string', nullable: true, description: 'More detailed error information (e.g., stack trace or specific validation failure).' },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    });
  });

  /**
   * Serves the Scalar API Reference, an alternative interactive documentation UI.
   * @route GET /api-reference
   */
  docs.get('/api-reference', apiReference({
    spec: {
      url: '/openapi.json',
    },
  }));

  return docs;
};