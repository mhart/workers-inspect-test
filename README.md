# workers-inspect-test

A demo Worker showing different strategies to inspect the first 10kb from a downstream response, while still providing streaming.

## Approach 1: Cloning

This approach clones the body, so it can be read in parallel.

For the cloned stream, we use a BYOB reader with the `min` argument (this used to be a custom CF extension called `readAtLeast`) so we can read at least 10kb bytes, and then we cancel that stream.

See src/index.js for more details

## Approach 2: Creating a new stream

This approach also reads the first 10kb bytes using the same BYOB reader method, but it does it off the original stream, not a cloned stream.

Then we create a new response stream, first pushing the 10kb we've already read, and the rest of the original stream.

See src/index.js for more details
