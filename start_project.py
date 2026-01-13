import os
import subprocess
import sys

def get_env_path():
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', '.env')

def read_env(env_path):
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()
    return env_vars

def write_env(env_path, env_vars):
    with open(env_path, 'w') as f:
        for key, value in env_vars.items():
            f.write(f"{key}={value}\n")

def main():
    print("="*50)
    print("AI Quiz Generator - Startup Configuration")
    print("="*50)

    env_path = get_env_path()
    env_vars = read_env(env_path)

    print("\nSelect AI Provider:")
    print("1. Ollama (Local - Free, Private)")
    print("2. Groq (Cloud - Fast, Requires API Key)")
    
    while True:
        choice = input("\nEnter your choice (1/2) [default: 1]: ").strip()
        if choice == '' or choice == '1':
            provider = 'ollama'
            break
        elif choice == '2':
            provider = 'groq'
            break
        else:
            print("Invalid choice. Please try again.")

    env_vars['LLM_PROVIDER'] = provider
    print(f"\nSelected Provider: {provider.upper()}")

    if provider == 'groq':
        groq_key = env_vars.get('GROQ_API_KEY', '')
        if not groq_key or groq_key == 'your-groq-api-key':
            print("\nGroq API Key is missing or invalid.")
            new_key = input("Please enter your Groq API Key: ").strip()
            if new_key:
                env_vars['GROQ_API_KEY'] = new_key
            else:
                print("Warning: No API key provided. Groq might fail.")

    # Save changes to .env
    write_env(env_path, env_vars)
    print(f"\nConfiguration saved to {env_path}")

    # Start the server
    print("\nStarting Django Server...")
    print("="*50)
    
    # Run the backend startup (assuming windows based on context)
    # We'll rely on the existing batch file logic but run it from python or just call python directly
    # To ensure venv is used, we can try to call the bat file or python directly if we are in venv
    
    manage_py = os.path.join('backend', 'manage.py')
    
    # Check if we are in venv (sys.prefix != sys.base_prefix)
    # But usually one would run this script from the venv or double click it.
    # Let's try to run `backend/manage.py runserver` using the current python interpreter
    # assuming the user runs `python start_project.py` from the environment.
    
    # If the user runs this from outside venv, we might want to activate it.
    # Since I cannot easily activate venv and stay in python, I will attempt to run the existing batch file if present
    # or just run python directly assuming requirements are met.
    
    if os.path.exists('temp_run_backend.bat'):
         subprocess.call(['temp_run_backend.bat'], shell=True)
    else:
         subprocess.call([sys.executable, manage_py, 'runserver'])

if __name__ == "__main__":
    main()
