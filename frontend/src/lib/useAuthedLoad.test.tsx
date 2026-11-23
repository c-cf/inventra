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

describe("useAuthedLoad when the page changes its data while the reload is out (#43)", () => {
  it("asks again, so the answer includes the change", async () => {
    const reload = deferred<string>();
    await renderShownAgain(Promise.resolve(alice), reload.promise);
    load.mockResolvedValueOnce("fresh, with the change");

    await userEvent.setup().click(screen.getByRole("button", { name: "Change" }));
    await act(async () => reload.resolve("from before the change"));

    expect(await screen.findByText("alice: fresh, with the change")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("keeps the change on screen until the new answer lands", async () => {
    const reload = deferred<string>();
    const again = deferred<string>();
    await renderShownAgain(Promise.resolve(alice), reload.promise);
    load.mockReturnValueOnce(again.promise);

    await userEvent.setup().click(screen.getByRole("button", { name: "Change" }));
    await act(async () => reload.resolve("from before the change"));

    expect(screen.getByText("alice: changed on the page")).toBeInTheDocument();
  });

  it("asks only once when the page did not change meanwhile", async () => {
    const reload = deferred<string>();
    await renderShownAgain(Promise.resolve(alice), reload.promise);

    await act(async () => reload.resolve("reloaded"));

    expect(screen.getByText("alice: reloaded")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("useAuthedLoad when the user leaves again before the reload lands", () => {
  async function leaveMidReloadAndComeBack() {
    const firstVisit = deferred<string>();
    const secondVisit = deferred<string>();
    load.mockResolvedValueOnce("first load");
    const { rerender } = render(page("visible"));
    await screen.findByText("alice: first load");
    load.mockReturnValueOnce(firstVisit.promise).mockReturnValueOnce(secondVisit.promise);
    rerender(page("hidden"));
    rerender(page("visible")); // reload for this visit is still out...
    rerender(page("hidden")); // ...when the user leaves again
    rerender(page("visible"));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(3));
    await act(async () => secondVisit.resolve("from the second visit"));
    await screen.findByText("alice: from the second visit");
    return firstVisit;
  }

  it("ignores data from a visit the user already left", async () => {
    const firstVisit = await leaveMidReloadAndComeBack();
    await userEvent.setup().click(screen.getByRole("button", { name: "Change" }));

    await act(async () => firstVisit.resolve("from the first visit"));

    expect(screen.getByText("alice: changed on the page")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(3); // a visit already left does not ask again
  });

  it("ignores a failure from a visit the user already left", async () => {
    const firstVisit = await leaveMidReloadAndComeBack();

    await act(async () => firstVisit.reject(new ApiError(500, "Database unavailable")));

    expect(screen.getByText("alice: from the second visit")).toBeInTheDocument();
  });
});

describe("useAuthedLoad on a page shown again that fails", () => {
  it("shows the error page for a failure other than a rejected session", async () => {
    const reload = deferred<string>();
    await renderShownAgain(Promise.resolve(alice), reload.promise);

    await act(async () => reload.reject(new ApiError(500, "Database unavailable")));

    expect(screen.getByText("error")).toBeInTheDocument();
    expect(hardNavigate).not.toHaveBeenCalled();
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
