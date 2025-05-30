import openai

# Set your OpenAI API key here or via the OPENAI_API_KEY environment variable
openai.api_key = "sk-your-api-key"

def prompt_codex(prompt_text):
    response = openai.Completion.create(
        engine="code-davinci-002",  # Codex model
        prompt=prompt_text,
        max_tokens=100,
        temperature=0
    )
    return response.choices[0].text.strip()

if __name__ == "__main__":
    prompt = "Write a Python function to reverse a string."
    print("Codex output:")
    print(prompt_codex(prompt))