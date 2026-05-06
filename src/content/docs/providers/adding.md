---
title: Adding a Provider
description: Implement a new ProviderContract or extend OpenAiCompatibleProvider.
---

PromptGate's provider layer is a small, deliberately boring abstraction: every provider implements `ProviderContract`, which has two methods (`chat`, `chatStream`) and four identity bits (`key`, `label`, `color`, `packageId`).

Adding a new provider takes ~30 lines if it's OpenAI-compatible, ~150 lines if it's not.

> A first-class **plugin marketplace** is on the roadmap (see **[Plugins](/plugins/marketplace/)**) — eventually you'll install providers as signed packages. Until then, you add them by dropping a class into `app/Services/Providers/` and registering it in `ProviderRegistry::__construct`.

## The contract

```php
<?php
namespace App\Services\Providers;

interface ProviderContract
{
    public function chat(string $apiKey, array $messages, array $options): ProviderResponse;

    /** @return iterable<string> */
    public function chatStream(string $apiKey, array $messages, array $options): iterable;

    public function key(): string;       // 'openai', 'anthropic', …
    public function label(): string;     // 'OpenAI', 'Anthropic', …
    public function color(): string;     // oklch(...) for UI badges
    public function packageId(): string; // '@promptgate/provider-foo'
}
```

`$messages` is `[{role, content}, …]`. `$options` carries `model`, `temperature`, `top_p`, `max_tokens`, `stream`. The return value is a `ProviderResponse` with `content`, `model`, `finishReason`, `promptTokens`, `completionTokens`, `totalTokens`, `id`.

## Path 1 — OpenAI-compatible provider

If your provider speaks OpenAI's `POST /chat/completions` shape, **don't reimplement** the contract. Extend `OpenAiCompatibleProvider`:

```php
<?php
namespace App\Services\Providers;

final class FooAiProvider extends OpenAiCompatibleProvider
{
    public function key(): string       { return 'fooai'; }
    public function label(): string     { return 'FooAI'; }
    public function color(): string     { return 'oklch(0.74 0.18 200)'; }
    public function packageId(): string { return '@promptgate/provider-fooai'; }

    protected function baseUrl(): string
    {
        return 'https://api.fooai.com/v1';
    }

    // Optional: override if the provider uses max_tokens vs max_completion_tokens
    // protected function maxTokensField(): string { return 'max_tokens'; }
}
```

Register it in `ProviderRegistry::__construct`:

```php
$this->register(new FooAiProvider());
```

That's it. Streaming, error handling, payload shape, and response parsing are all inherited from the base class.

The 5 OpenAI-compatible providers in PromptGate today (OpenAI, Mistral, Groq, Together, Ollama) are all written this way.

## Path 2 — Native (non-OpenAI) provider

If the provider has its own request/response shape (Anthropic, Google, Cohere fall in this bucket), implement `ProviderContract` directly. Use `AnthropicProvider` or `CohereProvider` as a reference.

Skeleton:

```php
<?php
namespace App\Services\Providers;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

final class FooAiProvider implements ProviderContract
{
    private const BASE_URL = 'https://api.fooai.com/v1';

    public function key(): string       { return 'fooai'; }
    public function label(): string     { return 'FooAI'; }
    public function color(): string     { return 'oklch(0.74 0.18 200)'; }
    public function packageId(): string { return '@promptgate/provider-fooai'; }

    public function chat(string $apiKey, array $messages, array $options): ProviderResponse
    {
        $payload = $this->buildPayload($messages, $options);

        try {
            $response = Http::withToken($apiKey)
                ->timeout(120)
                ->post(self::BASE_URL.'/chat', $payload);

            $response->throw();
            $data = $response->json();
        } catch (ConnectionException $e) {
            throw new RuntimeException('FooAI connection failed: '.$e->getMessage(), 502, $e);
        } catch (RequestException $e) {
            throw new RuntimeException(
                'FooAI API error: '.$e->response->json('error.message', $e->getMessage()),
                $e->response->status(),
                $e,
            );
        }

        return new ProviderResponse(
            content: $data['answer'] ?? '',
            model: $options['model'],
            finishReason: $this->mapFinishReason($data['stop_reason'] ?? 'unknown'),
            promptTokens: (int) ($data['tokens']['input'] ?? 0),
            completionTokens: (int) ($data['tokens']['output'] ?? 0),
            totalTokens: (int) ($data['tokens']['total'] ?? 0),
            id: $data['id'] ?? null,
        );
    }

    public function chatStream(string $apiKey, array $messages, array $options): iterable
    {
        // Translate upstream SSE event shape into OpenAI-shape chunks
        // so downstream session logging stays uniform.
        // ...
    }

    private function buildPayload(array $messages, array $options): array
    {
        // Map our generic shape onto the provider's payload shape.
    }

    private function mapFinishReason(string $upstream): string
    {
        return match ($upstream) {
            'COMPLETE' => 'stop',
            'TRUNCATED' => 'length',
            default => strtolower($upstream),
        };
    }
}
```

Things to watch for in a native adapter:

- **Auth header** — some providers use `Authorization: Bearer …`, others use a custom header (Anthropic uses `x-api-key`, Google uses query string).
- **Required version header** — Anthropic requires `anthropic-version: 2023-06-01`.
- **System message handling** — some providers (Anthropic) want system messages lifted out of the messages array; others (Cohere v2, OpenAI) accept them inline.
- **Parameter renames** — Cohere uses `p` instead of `top_p`. OpenAI's newer chat models use `max_completion_tokens` instead of `max_tokens`.
- **finish_reason normalisation** — map provider-specific values back to `stop` / `length` / `tool_calls` / `error` so endpoint logic doesn't have to know which provider responded.
- **Streaming chunk format** — every adapter that streams must emit OpenAI-shape `data: {...}` chunks ending with `data: [DONE]`. Otherwise downstream buffering and session logging breaks.

## Tests

Each provider in this repo has a `Http::fake()`-driven feature test that checks:

- The right URL is hit
- The auth header has the right shape
- Payload uses the right field names (`max_tokens` vs `max_completion_tokens`, `p` vs `top_p`)
- Response is parsed into a correct `ProviderResponse`
- Errors are surfaced as `RuntimeException` with the provider's label

Mirror that pattern for your own provider — see `tests/Feature/CohereProviderTest.php` for an example.

## When the marketplace ships

Once the **plugin marketplace** is wired:

- Providers ship as signed packages (`@promptgate/provider-foo`).
- They register themselves via a manifest read at boot.
- You install with `php artisan plugin:install @promptgate/provider-foo`.

Until then, in-tree extension is the supported path.

---

Next: **[Authentication](/security/authentication/)** — the security section.

---

> © Akyros Labs LLC. All rights reserved.
