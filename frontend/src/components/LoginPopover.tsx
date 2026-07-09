import { Database, KeyRound, Mail } from "lucide-react";
import { type FormEvent, useState } from "react";

type LoginPopoverProps = {
  loading: boolean;
  error: string;
  onLogin: (email: string, password: string) => Promise<void>;
};

export function LoginPopover({ loading, error, onLogin }: LoginPopoverProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onLogin(email, password);
  }

  return (
    <aside className="topbar-login" aria-label="Area de acesso">
      <div className="login-brand">
        <Database size={30} />
        <div>
          <span>Acesso seguro</span>
          <strong>Entrar no LeitorBI</strong>
        </div>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <label>
          <span>Usuario ou e-mail</span>
          <div>
            <Mail size={17} />
            <input
              autoComplete="username"
              autoFocus
              type="text"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
        </label>

        <label>
          <span>Senha</span>
          <div>
            <KeyRound size={17} />
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
        </label>

        {error ? <div className="error">{error}</div> : null}

        <button className="primary-action" type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </aside>
  );
}
