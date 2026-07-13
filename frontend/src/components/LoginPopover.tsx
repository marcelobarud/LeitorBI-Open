import { Database, KeyRound, Mail, UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";

type LoginPopoverProps = {
  loading: boolean;
  error: string;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (name: string, email: string, password: string) => Promise<void>;
};

export function LoginPopover({ loading, error, onLogin, onRegister }: LoginPopoverProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [localError, setLocalError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError("");
    setSuccess("");

    if (mode === "login") {
      await onLogin(email, password);
      return;
    }

    if (password !== passwordConfirmation) {
      setLocalError("A confirmação de senha deve ser igual à senha.");
      return;
    }

    try {
      await onRegister(name, email, password);
      setMode("login");
      setName("");
      setPassword("");
      setPasswordConfirmation("");
      setSuccess("Conta criada com sucesso. Entre com seu e-mail e senha.");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Erro inesperado ao criar conta.");
    }
  }

  function switchMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setLocalError("");
    setSuccess("");
  }

  return (
    <aside className="topbar-login" aria-label="Area de acesso">
      <div className="login-brand">
        {mode === "login" ? <Database size={30} /> : <UserPlus size={30} />}
        <div>
          <span>Acesso seguro</span>
          <strong>{mode === "login" ? "Entrar no LeitorBI" : "Criar conta"}</strong>
        </div>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        {mode === "register" ? (
          <label>
            <span>Nome</span>
            <div>
              <UserPlus size={17} />
              <input
                autoComplete="name"
                autoFocus
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
          </label>
        ) : null}

        <label>
          <span>E-mail</span>
          <div>
            <Mail size={17} />
            <input
              autoComplete="username"
              autoFocus={mode === "login"}
              type="email"
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
              minLength={mode === "register" ? 8 : undefined}
              required
            />
          </div>
        </label>

        {mode === "register" ? (
          <label>
            <span>Confirmar senha</span>
            <div>
              <KeyRound size={17} />
              <input
                autoComplete="new-password"
                type="password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                minLength={8}
                required
              />
            </div>
          </label>
        ) : null}

        {error && mode === "login" ? <div className="error">{error}</div> : null}
        {localError ? <div className="error">{localError}</div> : null}
        {success ? <div className="status">{success}</div> : null}

        <button className="primary-action" type="submit" disabled={loading}>
          {loading ? "Processando..." : mode === "login" ? "Entrar" : "Criar conta"}
        </button>
      </form>
      <button
        className="login-mode-button"
        type="button"
        onClick={() => switchMode(mode === "login" ? "register" : "login")}
        disabled={loading}
      >
        {mode === "login" ? "Criar conta" : "Já tenho conta"}
      </button>
    </aside>
  );
}
