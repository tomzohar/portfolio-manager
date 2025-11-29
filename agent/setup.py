from setuptools import setup, find_packages

setup(
    name="portfolio_manager",
    version="2.0.0",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "gspread",
        "google-auth",
        "google-search-results",
        "google-genai",
        "python-dotenv",
        "pytest",
        "pytest-mock",
        "tenacity==8.2.3",
        "google-generativeai==0.7.2",
        "pandas",
        "pandas-ta",
        "polygon-api-client",
        "sentry-sdk",
        "langgraph",
        "langchain-core",
    ],
    entry_points={
        "console_scripts": [
            "portfolio-manager=portfolio_manager.graph.main:main",
        ],
    },
)
