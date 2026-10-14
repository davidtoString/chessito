FROM node:24-bookworm-slim AS compiler
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git g++ make bc gawk binutils meson ninja-build pkg-config libopenblas-dev zlib1g-dev libprotobuf-dev protobuf-compiler && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone --depth 1 --branch v25.2 --recurse-submodules https://github.com/jdart1/arasan-chess.git arasan && test "$(git -C arasan rev-parse HEAD)" = 729acdded807dc46b769110138a81edb1fbca30d && make -C arasan/src -j2 CC=g++ EXE=arasan BUILD_TYPE=old
RUN git clone --depth 1 --branch v0.31.2 --recurse-submodules https://github.com/LeelaChessZero/lc0.git lc0 && test "$(git -C lc0 rev-parse HEAD)" = 8ba8aa426460bbeda452754ff7d6a9bb60bb0e54 && cd lc0 && meson setup build --buildtype=release -Dgtest=false -Dblas=true -Dopencl=false -Dplain_cuda=false -Dcudnn=false -Dmetal=disabled -Ddx=false -Dispc=false -Dpopcnt=false -Df16c=false && ninja -C build -j2
RUN mkdir -p /models && for rating in 1100 1500 1900; do curl --fail --location --retry 3 "https://raw.githubusercontent.com/CSSLab/maia-chess/749204cf5979ce7f8b0412e804a4ee7c83c49ff8/maia_weights/maia-${rating}.pb.gz" -o "/models/maia-${rating}.pb.gz"; done && curl --fail --location --retry 3 https://storage.lczero.org/files/networks-contrib/t1-256x10-distilled-swa-2432500.pb.gz -o /models/leela.pb.gz

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends fairy-stockfish libopenblas0-pthread libgomp1 zlib1g libprotobuf32 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /service
COPY engines/package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=compiler /src/arasan/bin/arasan /opt/arasan/arasan
COPY --from=compiler /src/arasan/network /opt/arasan/network
COPY --from=compiler /src/arasan/network/arasanv4-20250621.nnue /opt/arasan/arasanv4-20250621.nnue
COPY --from=compiler /src/arasan/LICENSE /opt/arasan/LICENSE
COPY --from=compiler /src/lc0/build/lc0 /opt/lc0/lc0
COPY --from=compiler /src/lc0/COPYING /opt/lc0/COPYING
COPY --from=compiler /models /models
COPY engines/server.mjs engines/uci.mjs ./
ENV OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1
USER node
EXPOSE 8000
HEALTHCHECK --interval=30s --start-period=30s CMD node -e "fetch('http://127.0.0.1:8000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
