import { main } from '@/index.js'

test('says Hello World', () => {
    const str = main()
    expect(str).toBe('Hello World.');
})
