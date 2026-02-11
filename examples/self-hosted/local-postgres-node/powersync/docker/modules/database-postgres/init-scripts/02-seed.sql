-- Demo row for the Node.js app
INSERT INTO todos (id, content, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Hello from PowerSync!',
  now()
)
ON CONFLICT (id) DO NOTHING;
