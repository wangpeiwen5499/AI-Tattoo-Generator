// Template test endpoint: real verification mail is sent only by Better Auth.
export async function POST(_req: Request): Promise<Response> {
  return Response.json(
    { error: 'Endpoint retired' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } }
  );
}
