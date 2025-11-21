from setuptools import setup, find_packages

setup(
    name="stock_researcher",
    version="0.1.0",
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
        "sentry-sdk"
    ],
    entry_points={
        "console_scripts": [
            "stock-researcher=stock_researcher.main:main",
        ],
    },
)
