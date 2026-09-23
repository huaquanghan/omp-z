import { afterEach, describe, expect, it, vi } from "bun:test";
import { getLatestRelease, runUpdateCommand } from "../../src/cli/update-cli";

type FetchInput = string | URL | Request;
type FetchInit = RequestInit | BunFetchRequestInit;

describe("runUpdateCommand fetch cancellation", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("checks release metadata with a timeout signal", async () => {
		let requestSignal: AbortSignal | undefined;
		vi.spyOn(console, "log").mockImplementation(() => {});
		const fetchStub = Object.assign(
			async (_input: FetchInput, init?: FetchInit) => {
				requestSignal = init?.signal ?? undefined;
				return new Response(null, {
					status: 302,
					headers: { location: "https://github.com/huaquanghan/omp-z/releases/tag/ompz-v999.0.0" },
				});
			},
			{ preconnect: globalThis.fetch.preconnect },
		);
		vi.spyOn(globalThis, "fetch").mockImplementation(fetchStub);

		await runUpdateCommand({ force: false, check: true });

		expect(requestSignal).toBeInstanceOf(AbortSignal);
	});
});

describe("getLatestRelease fork releases", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	function stubLatestRelease(location: string | undefined, status = 302): string[] {
		const urls: string[] = [];
		const fetchStub = Object.assign(
			async (input: FetchInput) => {
				urls.push(String(input));
				return new Response(null, {
					status,
					headers: location ? { location } : {},
				});
			},
			{ preconnect: globalThis.fetch.preconnect },
		);
		vi.spyOn(globalThis, "fetch").mockImplementation(fetchStub);
		return urls;
	}

	it("resolves the latest ompz tag through the fork's releases/latest redirect", async () => {
		const urls = stubLatestRelease("https://github.com/huaquanghan/omp-z/releases/tag/ompz-v999.1.0");

		const release = await getLatestRelease();

		expect(urls).toEqual(["https://github.com/huaquanghan/omp-z/releases/latest"]);
		expect(release.tag).toBe("ompz-v999.1.0");
		expect(release.version).toBe("999.1.0");
		expect(release.dist).toBe("binary");
	});

	it("keeps the fork's release-spin suffix in the resolved version", async () => {
		stubLatestRelease("https://github.com/huaquanghan/omp-z/releases/tag/ompz-v18.2.10-1");

		const release = await getLatestRelease({ channel: "canary" });

		expect(release.version).toBe("18.2.10-1");
	});

	it("throws when GitHub does not redirect to a release tag", async () => {
		stubLatestRelease(undefined, 404);

		await expect(getLatestRelease()).rejects.toThrow("Could not resolve the latest huaquanghan/omp-z release");
	});
});

describe("getLatestRelease proxy errors", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("translates Bun's UnsupportedProxyProtocol fetch failure into an actionable CLI message", async () => {
		const fetchStub = Object.assign(
			async () => {
				throw new Error(
					'UnsupportedProxyProtocol fetching "https://github.com/huaquanghan/omp-z/releases/latest". ' +
						"For more information, pass `verbose: true` in the second argument to fetch()",
				);
			},
			{ preconnect: globalThis.fetch.preconnect },
		);
		vi.spyOn(globalThis, "fetch").mockImplementation(fetchStub);

		const err = await getLatestRelease({ timeoutMs: 5000 }).then(
			() => null,
			(e: unknown) => e as Error,
		);

		expect(err).toBeInstanceOf(Error);
		// The raw fetch() instruction the CLI user cannot act on must not leak through.
		expect(err?.message).not.toContain("verbose: true");
		expect(err?.message).not.toContain("fetch()");
		// Instead the user gets actionable guidance about supported proxy schemes.
		expect(err?.message).toMatch(/SOCKS/i);
		expect(err?.message).toMatch(/https?:\/\//i);
	});
});
