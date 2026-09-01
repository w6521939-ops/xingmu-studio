import { Composition } from 'remotion'
import { ManjuDrama } from './compositions/ManjuDrama.js'

export const RemotionRoot = () => {
  return (
    <Composition
      id="manju-drama"
      component={ManjuDrama}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        items: [],
        subtitleCues: [],
        subtitleStyle: {},
        audioTracks: [],
      }}
    />
  )
}
