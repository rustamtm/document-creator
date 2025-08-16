import asyncio
import grpc
from fastapi import FastAPI
from typing import AsyncIterator

from proto import translation_pb2_grpc, translation_pb2
from proto import tts_pb2_grpc, tts_pb2

app = FastAPI()

@app.get("/health")
async def health():
    return {"status": "ok"}


class TranslationService(translation_pb2_grpc.TranslationServiceServicer):
    async def Translate(self, request: translation_pb2.TranslateRequest, context: grpc.aio.ServicerContext) -> translation_pb2.TranslateResponse:
        # Placeholder implementation
        return translation_pb2.TranslateResponse(text=request.text)


class TTSService(tts_pb2_grpc.TTSServiceServicer):
    async def Synthesize(self, request: tts_pb2.TTSRequest, context: grpc.aio.ServicerContext) -> tts_pb2.TTSResponse:
        # Placeholder implementation
        return tts_pb2.TTSResponse(audio=b"")


async def serve_grpc() -> None:
    server = grpc.aio.server()
    translation_pb2_grpc.add_TranslationServiceServicer_to_server(TranslationService(), server)
    tts_pb2_grpc.add_TTSServiceServicer_to_server(TTSService(), server)
    server.add_insecure_port("0.0.0.0:50051")
    await server.start()
    await server.wait_for_termination()


if __name__ == "__main__":
    import uvicorn

    loop = asyncio.get_event_loop()
    loop.create_task(serve_grpc())
    uvicorn.run(app, host="0.0.0.0", port=8000)
