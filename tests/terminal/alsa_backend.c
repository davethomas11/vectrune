#include <alsa/asoundlib.h>
#include <errno.h>
#include <stdio.h>

int main(void) {
    snd_input_t *input = NULL;
    snd_config_t *config = NULL;
    snd_pcm_t *pcm = NULL;
    const char definition[] = "pcm.null { type null }\n";
    int result = snd_input_buffer_open(&input, definition, sizeof(definition) - 1);
    if (result >= 0) result = snd_config_top(&config);
    if (result >= 0) result = snd_config_load(config, input);
    if (result >= 0) result = snd_pcm_open_lconf(&pcm, "null", SND_PCM_STREAM_PLAYBACK, 0, config);
    if (result >= 0) {
        result = snd_pcm_set_params(pcm, SND_PCM_FORMAT_S16_LE,
                                   SND_PCM_ACCESS_RW_INTERLEAVED, 1, 48000, 1, 100000);
    }
    if (result >= 0) {
        short samples[128] = {0};
        snd_pcm_sframes_t written = snd_pcm_writei(pcm, samples, 128);
        result = written == 128 ? 0 : (written < 0 ? (int)written : -EIO);
    }
    if (result < 0) fprintf(stderr, "ALSA null output check: %s\n", snd_strerror(result));
    if (pcm) snd_pcm_close(pcm);
    if (config) snd_config_delete(config);
    if (input) snd_input_close(input);
    return result < 0;
}
