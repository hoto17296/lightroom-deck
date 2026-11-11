FROM oven/bun:1

WORKDIR /workspace

# Common Packages
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git openssh-client \
  && rm -rf /var/lib/apt/lists/*