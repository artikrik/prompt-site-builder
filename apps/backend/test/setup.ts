import 'reflect-metadata';

// Mock external API calls to prevent real API usage in tests
vi.mock('@anthropic-ai/sdk', () => ({
  Anthropic: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"hugoConfig": {}, "content": []}' }],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 100, output_tokens: 200 },
      }),
    },
  })),
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: '{"hugoConfig": {}, "content": []}' } }],
          model: 'gpt-4o',
          usage: { prompt_tokens: 100, completion_tokens: 200 },
        }),
      },
    },
    images: {
      generate: vi.fn().mockResolvedValue({
        data: [{ url: 'https://example.com/image.png', revised_prompt: 'revised prompt' }],
      }),
    },
  })),
}));
