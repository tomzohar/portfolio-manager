# Frontend Initialization Plan

This plan initializes an Nx workspace in the `frontend/` directory with Angular, Angular Material, and NgRx, configured for a monorepo structure.

## 1. Workspace & Application Setup
- Initialize Nx workspace inside `frontend/`.
- Create the main Angular application `client`.
- **Command**: `npx create-nx-workspace@latest frontend --preset=angular --appName=client --style=scss --bundler=esbuild --skipGit --nxCloud=skip`
- **Configuration**: 
    - Preset: Angular
    - Style: SCSS
    - Bundler: ESBuild
    - Monorepo: Integrated (Nx default)

## 2. Dependencies Installation
- **Angular Material**: `npm install @angular/material @angular/cdk`
- **NgRx**: `npm install @ngrx/store @ngrx/effects @ngrx/entity @ngrx/store-devtools`

## 3. Monorepo Libraries Setup
Create independent libraries for types and styles to enforce separation of concerns.
- **Types Library**: 
    - Path: `libs/types`
    - Import Path: `@stocks-researcher/types`
    - Purpose: Shared interfaces and DTOs (e.g., `Portfolio`, `Position`).
- **Styles Library**:
    - Path: `libs/styles`
    - Import Path: `@stocks-researcher/styles`
    - Purpose: Shared SCSS variables, mixins, and global styles.

## 4. Application Configuration
- **Material Design**: Configure `styles.scss` to include Angular Material theme.
- **State Management**: Initialize root NgRx store in `app.config.ts` (assuming Standalone).

## 5. Note on Backend
- Since no REST API currently exists, the frontend services will initially use mock data.

