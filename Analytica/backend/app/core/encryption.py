"""
AES-256-GCM encryption for sensitive fields (investor passwords).
ENCRYPTION_KEY env var must be a base64-encoded 32-byte key.
Generate with:
  python -c "import os,base64; print(base64.b64encode(os.urandom(32)).decode())"
"""
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _get_key() -> bytes:
    raw = os.getenv("ENCRYPTION_KEY", "")
    if not raw:
        raise RuntimeError("ENCRYPTION_KEY env var not set.")
    key = base64.b64decode(raw)
    if len(key) != 32:
        raise RuntimeError("ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).")
    return key


def encrypt_field(plaintext: str) -> str:
    """Encrypt a string with AES-256-GCM. Returns base64(nonce + ciphertext+tag)."""
    key = _get_key()
    nonce = os.urandom(12)          # 96-bit nonce — GCM standard
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ciphertext).decode("ascii")


def decrypt_field(encrypted: str) -> str:
    """Decrypt a value produced by encrypt_field."""
    key = _get_key()
    data = base64.b64decode(encrypted)
    nonce, ciphertext = data[:12], data[12:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, None).decode("utf-8")
