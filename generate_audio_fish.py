import sys, os
import ffmpeg
from fish_audio_sdk import Session, TTSRequest
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("FISH_API_KEY")
model_id = os.getenv("FISH_MODEL_ID")

if not api_key or not model_id:
    print("❌ FISH_API_KEY ou FISH_MODEL_ID ausentes.", file=sys.stderr)
    sys.exit(1)

if len(sys.argv) < 3:
    print("Uso: python generate_audio_fish.py 'texto' 'saida.mp3'", file=sys.stderr)
    sys.exit(1)

text = sys.argv[1]
mp3_out = sys.argv[2]
ogg_out = mp3_out.replace('.mp3', '.ogg')

try:
    session = Session(api_key)
    req = TTSRequest(text=text, reference_id=model_id)
    with open(mp3_out, "wb") as f:
        for chunk in session.tts(req):
            f.write(chunk)
    if os.path.exists(mp3_out):
        ffmpeg.input(mp3_out).output(ogg_out, acodec='libopus', format='ogg').overwrite_output().run(capture_stdout=True, capture_stderr=True)
        os.remove(mp3_out)
    else:
        raise FileNotFoundError("MP3 não gerado.")
except Exception as e:
    print("❌ Erro ao gerar áudio:", file=sys.stderr)
    print(e, file=sys.stderr)
    sys.exit(1)
