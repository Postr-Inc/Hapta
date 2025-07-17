import { Hono } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";
import { rqHandler } from "..";

const embededRoute = new Hono();

type EmbedProps = {
  title: string;
  description: string;
  url: string;
  image?: string;
  authorName?: string;
  children?: any;
};

function Embed({ title, description, url, image, authorName, children }: EmbedProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>

        {/* Open Graph */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={url} />
        {image && <meta property="og:image" content={image} />}

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        {image && <meta name="twitter:image" content={image} />}
        {authorName && <meta name="twitter:creator" content={`@${authorName}`} />}
      </head>
      <body
        style={{
          margin: "0",
          padding: "1rem",
          fontFamily: "Arial, sans-serif",
          backgroundColor: "#f9f9f9",
          color: "#222",
        }}
      >
        <article
          style={{
            maxWidth: "600px",
            margin: "auto",
            backgroundColor: "#fff",
            padding: "1rem",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          {image && (
            <img
              src={image}
              alt={title}
              style={{ width: "100%", borderRadius: "8px", objectFit: "cover" }}
            />
          )}
          <h1 style={{ marginTop: "1rem" }}>{title}</h1>
          <p style={{ color: "#555", fontSize: "1rem" }}>{description}</p>
          {authorName && (
            <footer style={{ marginTop: "2rem", fontSize: "0.9rem", color: "#888" }}>
              By @{authorName}
            </footer>
          )}
        </article>
        {children}
      </body>
    </html>
  );
}
 
embededRoute.get("/v2/:collection/:id", async (c) => {
  const id = c.req.param("id");
  const collection = c.req.param("collection");

  const data = await rqHandler.crudManager.get(
    {
      id,
      collection,
      cacheKey: `embed-${id}`,
      options: {
        expand: ["author"],
      },
    },
    "admin_served"
  );

  if (!data) {
    c.status(404);
    return c.text("Embed content not found.");
  }

  const author = data._payload.expand.author;
  const title = author?.username || "Post";
  const rawContent = data._payload.content || "";
  const description = rawContent.length > 200 ? rawContent.slice(0, 197) + "..." : rawContent;

  // Construct image URL if available
  const image = author?.avatar
    ? `https://api.postlyapp.com/api/files/users/${author.id}/${author.avatar}`
    : undefined;

  const url = `https://postlyapp.com/view/posts/${data._payload.id}`;

  return c.render(
    <Embed title={title} description={description} url={url} image={image} authorName={author?.username}>
      {/* Optional additional content */}
    </Embed>
  );
});

export default embededRoute;
