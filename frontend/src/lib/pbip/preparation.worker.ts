import { ModelPreparationError, type PreparationErrorCode } from "./preparation";
import { preparePbipZip } from "./zipProcessor";

type RequestMessage = { file: File };

const scope = self as unknown as {
  addEventListener: (type: "message", listener: (event: MessageEvent<RequestMessage>) => void) => void;
  postMessage: (message: unknown) => void;
};

scope.addEventListener("message", (event: MessageEvent<RequestMessage>) => {
  void preparePbipZip(event.data.file)
    .then((result) => scope.postMessage({ ok: true, result }))
    .catch((error: unknown) => {
      const code: PreparationErrorCode = error instanceof ModelPreparationError ? error.code : "operational";
      scope.postMessage({ ok: false, code });
    });
});
