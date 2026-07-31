param([string]$Source = "KioscoAppv4.jsx")

$ErrorActionPreference = "Stop"
$lines = Get-Content -Encoding UTF8 $Source

function Slice([int]$from, [int]$to) {
  return ($lines[($from - 1)..($to - 1)] -join "`n")
}

function Ensure-Dir([string]$path) {
  New-Item -ItemType Directory -Force -Path $path | Out-Null
}

function Write-Utf8([string]$path, [string]$content) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Join-Path (Get-Location) $path), $content, $utf8NoBom)
}

$folders = @(
  "src/app", "src/shared", "src/features/inicio", "src/features/stock",
  "src/features/vitrina", "src/features/ventas", "src/features/compras",
  "src/features/clientes", "src/features/reportes", "src/features/administracion",
  "src/features/autenticacion"
)
$folders | ForEach-Object { Ensure-Dir $_ }

$icons = @'
import {
  Package, Store, ShoppingCart, BarChart3, Shield, LogOut, ScanLine, Search,
  Plus, Pencil, Trash2, X, AlertTriangle, Save, Bell, Minus, ArrowUpCircle,
  ArrowDownCircle, Clock, Lock, Users, ClipboardList, Wallet, CreditCard,
  MessageCircle, CheckCircle2, PackageCheck, History, UserPlus, Banknote,
  ChevronRight,
} from "lucide-react";
'@

$sharedBlock = Slice 36 194
$sharedBlock = $sharedBlock -replace '(?m)^const ', 'export const '
Write-Utf8 "src/shared/domain.js" "$icons`n$sharedBlock`n"

$layout = (Slice 195 290) + "`n`n" + (Slice 418 441)
$layout = $layout -replace 'function Sidebar', 'export function Sidebar'
$layout = $layout -replace 'function SectionHeader', 'export function SectionHeader'
Write-Utf8 "src/shared/layout.jsx" "import React from `"react`";`n$icons`nimport { NAV_ITEMS } from `"./domain`";`n`n$layout`n"

$homeBlock = Slice 291 417
$homeBlock = $homeBlock -replace 'function Home', 'export function Home'
Write-Utf8 "src/features/inicio/Home.jsx" "import React from `"react`";`n$icons`nimport { HOME_CARDS, money } from `"../../shared/domain`";`nimport { permisosDe } from `"../../app/data`";`n`n$homeBlock`n"

function Write-Feature([string]$path, [int]$from, [int]$to, [string]$entry) {
  $body = Slice $from $to
  $body = $body -replace ("function " + [regex]::Escape($entry)), ("export function " + $entry)
  $header = "import React, { useState, useMemo, useEffect } from `"react`";`n$icons`nimport { CATEGORIES, UNIDAD_GRUPOS, unidadInfo, nowFecha, historialEntry, money } from `"../../shared/domain`";`nimport { SectionHeader } from `"../../shared/layout`";`n`n"
  Write-Utf8 $path ($header + $body + "`n")
}

Write-Feature "src/features/stock/StockView.jsx" 442 1020 "StockView"
Write-Feature "src/features/vitrina/VitrinaView.jsx" 1021 1151 "VitrinaView"
Write-Feature "src/features/ventas/VentasView.jsx" 1152 2399 "VentasView"
Write-Feature "src/features/reportes/ReportesView.jsx" 2400 2643 "ReportesView"
Write-Feature "src/features/compras/ComprasView.jsx" 2644 3066 "ComprasView"
Write-Feature "src/features/clientes/ClientesView.jsx" 3067 3624 "ClientesView"
Write-Feature "src/features/autenticacion/LoginView.jsx" 3625 3773 "LoginView"

$admin = Slice 3774 4717
$admin = $admin -replace 'function AdministracionView', 'export function AdministracionView'
Write-Utf8 "src/features/administracion/AdministracionView.jsx" "import React, { useState, useMemo } from `"react`";`n$icons`nimport { money } from `"../../shared/domain`";`nimport { SectionHeader } from `"../../shared/layout`";`n`n$admin`n"

$core = Slice 4718 4824
$core = $core -replace '(?m)^const defaultDataset', 'export const defaultDataset'
$core = $core -replace '(?m)^const categoriaEvento', 'export const categoriaEvento'
$core = $core -replace '(?m)^const permisosDe', 'export const permisosDe'
$core = $core -replace '(?m)^const rolesPorDefecto', 'export const rolesPorDefecto'
$core = $core -replace '(?m)^const seedCuentas', 'export const seedCuentas'
$core = $core -replace '(?m)^const seedDatos', 'export const seedDatos'
Write-Utf8 "src/app/data.js" "import { INITIAL_PRODUCTS } from `"../shared/domain`";`n`n$core`n"

$app = Slice 4825 $lines.Count
$app = $app -replace 'export default function KioscoApp', 'export default function KioscoApp'
$app = $app -replace 'window\.storage', 'storage'
$appHeader = @'
import React, { useEffect, useState } from "react";
import { storage } from "../shared/storage";
import { Sidebar } from "../shared/layout";
import { Home } from "../features/inicio/Home";
import { StockView } from "../features/stock/StockView";
import { VitrinaView } from "../features/vitrina/VitrinaView";
import { VentasView } from "../features/ventas/VentasView";
import { ComprasView } from "../features/compras/ComprasView";
import { ClientesView } from "../features/clientes/ClientesView";
import { ReportesView } from "../features/reportes/ReportesView";
import { AdministracionView } from "../features/administracion/AdministracionView";
import { LoginView } from "../features/autenticacion/LoginView";
import { defaultDataset, permisosDe, rolesPorDefecto, seedCuentas, seedDatos } from "./data";

'@
Write-Utf8 "src/app/KioscoApp.jsx" ($appHeader + $app + "`n")

Write-Utf8 "src/shared/storage.js" @'
const browserStorage = {
  async get(key) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? null : { value };
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
  async delete(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

const hasClaudeStorage =
  typeof window !== "undefined" &&
  typeof window.storage?.get === "function" &&
  typeof window.storage?.set === "function" &&
  typeof window.storage?.delete === "function";

export const storage = hasClaudeStorage ? window.storage : browserStorage;
'@

Write-Utf8 "src/main.jsx" @'
import React from "react";
import ReactDOM from "react-dom/client";
import KioscoApp from "./app/KioscoApp";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><KioscoApp /></React.StrictMode>
);
'@

Write-Utf8 "src/styles.css" @'
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { min-height: 100%; margin: 0; }
'@

Write-Utf8 "package.json" @'
{
  "name": "kiosco-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": { "dev": "vite", "build": "vite build", "preview": "vite preview" },
  "dependencies": { "@vitejs/plugin-react": "latest", "lucide-react": "latest", "react": "latest", "react-dom": "latest", "vite": "latest" },
  "devDependencies": { "autoprefixer": "latest", "postcss": "latest", "tailwindcss": "^3.4.17" }
}
'@

Write-Utf8 "index.html" @'
<!doctype html>
<html lang="es">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>KioscoApp</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>
'@

Write-Utf8 "vite.config.js" @'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ base: "./", plugins: [react()] });
'@

Write-Utf8 "tailwind.config.js" @'
export default { content: ["./index.html", "./src/**/*.{js,jsx}"], theme: { extend: {} }, plugins: [] };
'@

Write-Utf8 "postcss.config.js" @'
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
'@

Write-Output "Proyecto dividido en src/."
