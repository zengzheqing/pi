// Regression direction for https://github.com/earendil-works/pi/issues/10864
import { describe, expect, it } from "vitest";
import { lazyApi } from "../src/api/lazy.ts";
import { getApiProvider } from "../src/compat.ts";
import { type CreateProviderOptions, createProvider } from "../src/models.ts";
import type { Api, Model, ProviderStreams, TranscriptContext } from "../src/types.ts";

function fakeStreams(): ProviderStreams {
	const inert = undefined as unknown as ReturnType<ProviderStreams["stream"]>;
	return {
		stream: () => inert,
		streamSimple: () => inert,
	};
}

function chatModel(api: string): Model<any> {
	return { id: "test-model", provider: "test", api, type: "chat" } as unknown as Model<any>;
}

const unusedContext = { messages: [] } as unknown as TranscriptContext;

describe("ProviderStreams.preload", () => {
	it("lazyApi preload() forces the implementation to load exactly once per call", async () => {
		let loads = 0;
		const api = lazyApi(async () => {
			loads += 1;
			return fakeStreams();
		});
		expect(loads).toBe(0);
		await api.preload?.();
		expect(loads).toBe(1);
		// The stream surface stays intact alongside preload.
		expect(typeof api.stream).toBe("function");
		expect(api.stream(chatModel("x"), unusedContext)).toBeDefined();
	});

	it("createProvider preload() dispatches to the model's api implementation", async () => {
		let loads = 0;
		const lazyStreams = lazyApi(async () => {
			loads += 1;
			return fakeStreams();
		});
		const provider = createProvider({
			id: "test",
			auth: {},
			api: { "test-api": lazyStreams },
			models: [chatModel("test-api")],
		} as unknown as CreateProviderOptions<Api>);
		expect(loads).toBe(0);
		await provider.preload?.(chatModel("test-api"));
		expect(loads).toBe(1);
		// An api without an implementation (or a concrete one without preload) resolves quietly.
		await provider.preload?.(chatModel("other-api"));
	});

	it("compat-registered builtin APIs expose preload", async () => {
		const api = getApiProvider("openai-completions");
		expect(typeof api?.preload).toBe("function");
		// Loading the module is side-effect free; no request is made.
		await api?.preload?.();
	});
});
