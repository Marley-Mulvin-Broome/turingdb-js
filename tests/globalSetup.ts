async function checkConnection(): Promise<boolean> {
  try {
    const result = await fetch("http://localhost:6670/list_avail_graphs", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    return result.status === 200;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export async function setup() {
  const ok = await checkConnection();
  if (ok) {
    console.log("[globalSetup] TuringDB is ready");
    return;
  }

  throw new Error(
    "TuringDB is not reachable at http://localhost:6670.\n" +
      "Start it with: docker compose -f docker-compose.yml up -d --wait",
  );
}

export async function teardown() {}
