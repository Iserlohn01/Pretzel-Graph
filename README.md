# PretzelGraph

![The PretzelGraph editor, with an agent graph on the canvas](.github/assets/hero-editor.webp)

A visual agent graph runtime. Build agents on a canvas, from a single ReAct
loop to multi-agent systems. Graphs can loop, so an agent can reason, call a
tool, and go again. Any workflow can be published and reused as a node in
another, so agents nest and compose.

## Running it

Requires Docker and Node.

```bash
docker compose up -d            # postgres, redis, auth
cp .env.example .env
npm install
npm run dev                     # http://localhost:5173
```

Open http://localhost:5173 and sign up.

To run everything in containers instead:

```bash
docker compose --profile full up -d     # http://localhost:8080
```

### Notes

- Ports `5432`, `6379` and `9999` must be free.
- To use your own Postgres, point `DATABASE_URL` at an existing database.
- `PRETZEL_ENCRYPTION_KEY` must be 64 hex characters and the same for the backend
  and worker. Changing it makes stored credentials unreadable.

## License

[Elastic License 2.0](./LICENSE). Free to self-host; offering it as a hosted service requires a [commercial license](./COMMERCIAL-LICENSE.md).

## Contributing

External pull requests are not open yet — contribution terms are still being settled.
Issues and discussions are welcome.
