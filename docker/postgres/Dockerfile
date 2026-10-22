FROM postgres:17

# El servidor exige SSL al conectarse a la base (server/postgres-record-store.mjs).
# Un certificado autofirmado alcanza: el tráfico no sale de la red interna de Docker.
RUN openssl req -new -x509 -days 3650 -nodes -subj "/CN=db" \
      -out /var/lib/postgresql/server.crt -keyout /var/lib/postgresql/server.key \
 && chown postgres:postgres /var/lib/postgresql/server.crt /var/lib/postgresql/server.key \
 && chmod 600 /var/lib/postgresql/server.key

CMD ["postgres", "-c", "ssl=on", "-c", "ssl_cert_file=/var/lib/postgresql/server.crt", "-c", "ssl_key_file=/var/lib/postgresql/server.key"]
