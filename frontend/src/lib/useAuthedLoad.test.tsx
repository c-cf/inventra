import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, fetchMe, type User } from "@/lib/api";
import { hardNavigate } from "@/lib/hardNavigate";
import { useAuthedLoad } from "@/lib/useAuthedLoad";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchMe: vi.fn(),
}));

const alice: User = { id: 1, username: "alice", role: "admin" };
const load = vi.fn<() => Promise<string>>();

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((done, fail) => ((resolve = done), (reject = fail)));
  return { promise, resolve, reject };
}

/** A page that shows what useAuthedLoad holds and can change its data, like a filter does. */
function Page() {
  const { state, setData } = useAuthedLoad(load);
  if (state.status !== "ready") return <p>{state.status}</p>;
  return (
    <>
      <p>
        {state.user.username}: {state.data}
      </p>
      <button type="button" onClick={() => setData(() => "changed on the page")}>
        Change
      </button>
    </>
  );
}

// Next.js (Cache Components) keeps a visited page mounted inside <Activity mode="hidden">
// and runs its effects again when the user comes back.
function page(mode: "visible" | "hidden") {
  return (
    <Activity mode={mode}>
      <Page />
    </Activity>
  );
}

async function renderShownAgain(session: Promise<User>, reload: Promise<string>) {
  load.mockResolvedValueOnce("first load");
  const { rerender } = render(page("visible"));
  await screen.findByText("alice: first load");
  vi.mocked(fetchMe).mockReturnValueOnce(session);
  load.mockReturnValueOnce(reload);
  rerender(page("hidden"));
  rerender(page("visible"));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
}

beforeEach(() => {
  vi.mocked(fetchMe).mockReset().mockResolvedValue(alice);
  load.mockReset();
});

describe("useAuthedLoad on a page shown again (#40)", () => {
  it("shows the reloaded data without waiting for the session check", async () => {
    const session = deferred<User>();
    await renderShownAgain(session.promise, Promise.resolve("reloaded"));

    expect(await screen.findByText("alice: reloaded")).toBeInTheDocument();
  });

  it("keeps a change made after the reload when the session check answers last", async () => {
    const session = deferred<User>();
    const reload = deferred<string>();
    await renderShownAgain(session.promise, reload.promise);
    await act(async () => reload.resolve("reloaded"));

    await userEvent.setup().click(screen.getByRole("button", { name: "Change" }));
    await act(async () => session.resolve({ ...alice, username: "alice2" }));

    // The user is refreshed, but the reloaded data must not come back over the change.
    expect(screen.getByText("alice2: changed on the page")).toBeInTheDocument();
  });

  it("still sends a rejected session to /login after the data arrived", async () => {
    const session = deferred<User>();
    const reload = deferred<string>();
    await renderShownAgain(session.promise, reload.promise);
    await act(async () => reload.resolve("reloaded"));

    await act(async () => session.reject(new ApiError(401, "Not authenticated")));

    expect(hardNavigate).toHaveBeenCalledWith("/login");
  });

  it("still lets a rejected session win over a reload that failed first", async () => {
    const session = deferred<User>();
    const reload = deferred<string>();
    await renderShownAgain(session.promise, reload.promise);

    await act(async () => reload.reject(new ApiError(500, "Database unavailable")));
    await act(async () => session.reject(new ApiError(401, "Not authenticated")));

    expect(hardNavigate).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("Database unavailable")).not.toBeInTheDocument();
  });
});

describe("useAuthedLoad on the first load", () => {
  it("waits for both the session and the data", async () => {
    const session = deferred<User>();
    vi.mocked(fetchMe).mockReturnValueOnce(session.promise);
    load.mockResolvedValueOnce("first load");
    render(page("visible"));

    await waitFor(() => expect(load).toHaveBeenCalledOnce());
    expect(screen.getByText("loading")).toBeInTheDocument();
    await act(async () => session.resolve(alice));

    expect(screen.getByText("alice: first load")).toBeInTheDocument();
  });
});
