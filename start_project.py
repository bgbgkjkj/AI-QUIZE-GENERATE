import os
import subprocess
import sys
import shutil

def get_paths():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(base_dir, 'backend')
    env_path = os.path.join(backend_dir, '.env')
    example_env_path = os.path.join(backend_dir, '.env.example')
    return env_path, example_env_path

def ensure_env_exists(env_path, example_env_path):
    if not os.path.exists(env_path):
        print(f"No .env file found. Creating one from {os.path.basename(example_env_path)}...")
        if os.path.exists(example_env_path):
            shutil.copy(example_env_path, env_path)
            print("Created .env successfully.")
        else:
            print("Warning: .env.example not found. Creating empty .env.")
            with open(env_path, 'w') as f:
                f.write("")

def read_env(env_path):
    env_vars = {}
    lines = [] # Keep order and comments
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            lines = f.readlines()
            for line in lines:
                line_stripped = line.strip()
                if line_stripped and not line_stripped.startswith('#') and '=' in line_stripped:
                    key, value = line_stripped.split('=', 1)
                    env_vars[key.strip()] = value.strip()
    return env_vars, lines

def write_env(env_path, env_vars, original_lines):
    # We want to update variables in place if they exist, or append if not.
    # This preserves comments and structure.
    
    new_lines = []
    updated_keys = set()
    
    for line in original_lines:
        line_stripped = line.strip()
        if line_stripped and not line_stripped.startswith('#') and '=' in line_stripped:
            key, val = line_stripped.split('=', 1)
            key = key.strip()
            if key in env_vars:
                new_lines.append(f"{key}={env_vars[key]}\n")
                updated_keys.add(key)
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)
            
    # Append new keys
    for key, value in env_vars.items():
        if key not in updated_keys:
            new_lines.append(f"{key}={value}\n")
            
    with open(env_path, 'w') as f:
        f.writelines(new_lines)

def main():
    print("="*50)
    print("AI Quiz Generator - Startup Configuration")
    print("="*50)

    env_path, example_env_path = get_paths()
    ensure_env_exists(env_path, example_env_path)
    env_vars, original_lines = read_env(env_path)

    print("Select AI Provider:")
    print("1. Ollama (Local - Free, Private)")
    print("2. Groq (Cloud - Fast, Requires API Key)")
    print("3. Gemini (Google - High Quality, Requires API Key)")
    print("4. OpenAI (ChatGPT - Premium, Requires API Key)")
    
    while True:
        choice = input("\nEnter your choice (1/2/3/4) [default: 1]: ").strip()
        if choice == '' or choice == '1':
            provider = 'ollama'
            break
        elif choice == '2':
            provider = 'groq'
            break
        elif choice == '3':
            provider = 'gemini'
            break
        elif choice == '4':
            provider = 'openai'
            break
        else:
            print("Invalid choice. Please try again.")

    env_vars['LLM_PROVIDER'] = provider
    print(f"\nSelected Provider: {provider.upper()}")

    def check_update_key(provider_name, env_key):
        current_key = env_vars.get(env_key, '')
        masked_key = (current_key[:4] + '*' * (len(current_key) - 8) + current_key[-4:]) if len(current_key) > 8 else "Not Set/Invalid"
        print(f"\nCurrent {provider_name} API Key: {masked_key}")
        
        need_input = False
        if not current_key or 'your-' in current_key.lower():
            print("Key is missing or default placeholder.")
            need_input = True
        else:
             change = input("Do you want to change the API key? (y/N): ").strip().lower()
             need_input = (change == 'y' or change == 'yes')
        
        if need_input:
            while True:
                new_key = input(f"Please enter your {provider_name} API Key: ").strip()
                if new_key:
                    env_vars[env_key] = new_key
                    break
                else:
                    if not current_key or 'your-' in current_key.lower():
                         print("API Key cannot be empty.")
                    else:
                         print("Keeping existing key.")
                         break

    if provider == 'groq':
        check_update_key("Groq", "GROQ_API_KEY")
    elif provider == 'gemini':
        check_update_key("Gemini", "GEMINI_API_KEY")
    elif provider == 'openai':
        check_update_key("OpenAI", "OPENAI_API_KEY")

    # Save changes to .env
    write_env(env_path, env_vars, original_lines)
    print(f"\nConfiguration saved to {env_path}")

    # Start the server
    print("\nStarting Django Server...")
    print("="*50)
    
    manage_py = os.path.join('backend', 'manage.py')
    
    if os.path.exists('temp_run_backend.bat'):
         subprocess.call(['temp_run_backend.bat'], shell=True)
    else:
         subprocess.call([sys.executable, manage_py, 'runserver'])

if __name__ == "__main__":
    main()
