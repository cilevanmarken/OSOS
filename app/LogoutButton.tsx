"use client";

export default function LogoutButton() {
  async function logout() {
    try {
      await fetch("/api/login", { method: "DELETE" });
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <button type="button" onClick={logout} className="underline">
      Uitloggen
    </button>
  );
}
