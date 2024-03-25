const MAX_BYTES = 10 * 1024;

const routes = new Set(["/clone", "/stream"]);

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (!routes.has(pathname)) {
      return Response.json({ error: "Not Found" }, { status: 404 });
    }
    
    // This performs a 500MB fetch – so we can test values greater than Workers memory

    const downstreamResponse = await fetch(
      "https://testfileorg.netwet.net/500MB-CZIPtestfile.org.zip"
    );

    // Approach 1. Clone the body

    if (pathname === "/clone") {
      const stream = downstreamResponse.clone().body;
      const reader = stream.getReader({ mode: "byob" });

      // this used to be a custom extension called readAtLeast, now `min` is a standard
      const { value, done } = await reader.read(new Uint8Array(MAX_BYTES + 1), {
        min: MAX_BYTES + 1,
      });
      ctx.waitUntil(stream.cancel()); // nice to clean up, we don't need the rest of the cloned stream

      if (done || value.length <= MAX_BYTES) {
        // we have MAX_BYTES or less, do logging using value buffer here
      } else {
        // we have more than MAX_BYTES in the body, so don't log it
      }

      const res = new Response(downstreamResponse.body, downstreamResponse);

      res.headers.set("X-First-Chunk-Length", value.length); // should be 10kb + 1

      return res;
    }

    // Approach 2. Make a new stream from the original, no cloning

    if (pathname === "/stream") {
      const stream = downstreamResponse.body;
      const reader = stream.getReader({ mode: "byob" });

      // this used to be a custom extension called readAtLeast, now `min` is a standard
      const { value, done } = await reader.read(new Uint8Array(MAX_BYTES + 1), {
        min: MAX_BYTES + 1,
      });

      if (done || value.length <= MAX_BYTES) {
        // we have MAX_BYTES or less, do logging using value buffer here
      } else {
        // we have more than MAX_BYTES in the body, so don't log it
      }

      // save the original content length for our new stream
      const contentLength = +downstreamResponse.headers.get("content-length");

      // create a new stream for the response body
      const newStream = new ReadableStream({
        start(controller) {
          // first we enqueue the first chunk we read earlier
          controller.enqueue(value);
        },
        async pull(controller) {
          // then we just keep reading values as we get them
          const { value, done } = await reader.read(
            new Uint8Array(1024 * 1024) // whatever buffer size you want
          );

          if (done) {
            controller.close();
          } else {
            controller.enqueue(value);
          }
        },
        cancel(reason) {
          return stream.cancel(reason);
        },
      }).pipeThrough(new FixedLengthStream(contentLength)); // pipe to this to get a content-length header

      const res = new Response(newStream, downstreamResponse);

      res.headers.set("X-First-Chunk-Length", value.length); // should be 10kb + 1

      return res;
    }

    return Response.json({ error: "Not Found" }, { status: 404 });
  },
};
