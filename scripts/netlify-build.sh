#!/usr/bin/env bash
set -euo pipefail

REQUIRED_QUARTO_VERSION="${QUARTO_VERSION:-1.8.26}"

install_quarto() {
  echo "Installing Quarto ${REQUIRED_QUARTO_VERSION}…"
  WORKDIR="$(mktemp -d)"
  curl -fsSL "https://github.com/quarto-dev/quarto-cli/releases/download/v${REQUIRED_QUARTO_VERSION}/quarto-${REQUIRED_QUARTO_VERSION}-linux-amd64.tar.gz" -o "${WORKDIR}/quarto.tgz"
  tar -xzf "${WORKDIR}/quarto.tgz" -C "${WORKDIR}"
  export PATH="${WORKDIR}/quarto-${REQUIRED_QUARTO_VERSION}/bin:${PATH}"
}

CURRENT_QUARTO_VERSION=""
if command -v quarto >/dev/null 2>&1; then
  CURRENT_QUARTO_VERSION="$(quarto --version | head -n 1 | tr -d '[:space:]')"
fi

if [ -z "${CURRENT_QUARTO_VERSION}" ]; then
  echo "Quarto not found on the build image."
  install_quarto
elif [ "${CURRENT_QUARTO_VERSION}" != "${REQUIRED_QUARTO_VERSION}" ]; then
  echo "Quarto ${CURRENT_QUARTO_VERSION} found but ${REQUIRED_QUARTO_VERSION} is required."
  install_quarto
else
  echo "Using Quarto ${CURRENT_QUARTO_VERSION}."
fi

quarto render
