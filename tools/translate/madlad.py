# MADLAD-400 translation worker for i18n-translate --mode madlad (src/madlad.ts).
# Needs ctranslate2 and sentencepiece; argv[1] is the CTranslate2 conversion directory.
# stdin, one per line: {"target": "my", "texts": [...]}; stdout, one per line: {"out": [...]}.
import json
import os
import sys

import ctranslate2
import sentencepiece

model = sys.argv[1]
pieces = sentencepiece.SentencePieceProcessor(model_file=os.path.join(model, 'spiece.model'))
translator = ctranslate2.Translator(model, device='cpu', compute_type='int8', intra_threads=int(os.environ.get('THREADS', '8')))
for line in sys.stdin:
    job = json.loads(line)
    # The target tag leads the text and the source ends with </s>; without </s> the decoder repeats itself.
    batch = [pieces.encode(f"<2{job['target']}> {text}", out_type=str) + ['</s>'] for text in job['texts']]
    results = translator.translate_batch(batch, beam_size=2, max_decoding_length=256, max_batch_size=16)
    print(json.dumps({'out': [pieces.decode(r.hypotheses[0]) for r in results]}, ensure_ascii=False), flush=True)
