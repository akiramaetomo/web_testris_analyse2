export const SETTING_DEFINITIONS = [
    {
      key: 'speedIndex',
      label: '落下速度',
      options: [
        { label: '20G(833us)', value: 0.833 },
        { label: '10G(1.67ms)', value: 1.667 },
        { label: '5G(3.33ms)', value: 3.333 },
        { label: '1G(16.67ms)', value: 16.667 },
        { label: '0.5G(33.3ms)', value: 33.3 },
        { label: '50ms', value: 50 },
        { label: '100ms', value: 100 },
        { label: '500ms', value: 500 },
        { label: '1s', value: 1000 }
      ],
      defaultIndex: 3
    },
    {
      key: 'fieldSize',
      label: 'フィールド',
      options: [
        { label: '10×20', value: [10, 20] },
        { label: '15×30', value: [15, 30] },
        { label: '20×40', value: [20, 40] }
      ],
      defaultIndex: 0
    },
    {
      key: 'bgm',
      label: 'BGM',
      options: [
        { label: 'play', value: 'bgm_play' },
        { label: 'over', value: 'bgm_over' },
        { label: 'loop', value: 'loop1_v3' }
      ],
      defaultIndex: 0
    }
  ];
  